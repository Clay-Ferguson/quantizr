package org.subnode.service;

import java.awt.image.BufferedImage;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSFindIterable;
import com.mongodb.client.gridfs.model.GridFSFile;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.OutOfSpaceException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.MerkleLink;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.request.DeleteAttachmentRequest;
import org.subnode.request.UploadFromIPFSRequest;
import org.subnode.request.UploadFromUrlRequest;
import org.subnode.response.DeleteAttachmentResponse;
import org.subnode.response.UploadFromIPFSResponse;
import org.subnode.response.UploadFromUrlResponse;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.ImageUtil;
import org.subnode.util.LimitedInputStream;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeTypeUtils;
import org.subnode.util.MultipartFileSender;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;

/**
 * Service for managing node attachments.
 * 
 * Node attachments are binary attachments that the user can opload onto a node. Each node allows
 * either zero or one attachments. Uploading a new attachment wipes out and replaces the previous
 * attachment. If the attachment is an 'image' type then it gets displayed right on the page.
 * Otherwise a download link is what gets displayed on the node.
 */
@Component
public class AttachmentService {
	private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private AppProp appProp;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private GridFsTemplate grid;

	@Autowired
	private GridFSBucket gridFsBucket;

	@Autowired
	private IPFSService ipfsService;

	@Autowired
	private RunAsMongoAdminEx adminRunner;

	/*
	 * Upload from User's computer. Standard HTML form-based uploading of a file from user machine
	 */
	public ResponseEntity<?> uploadMultipleFiles(MongoSession session, final String binSuffix, final String nodeId,
			final MultipartFile[] uploadFiles, final boolean explodeZips, final boolean toIpfs, final boolean addAsChildren) {
		if (nodeId == null) {
			throw ExUtil.wrapEx("target nodeId not provided");
		}

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			/*
			 * OLD LOGIC: Uploading a single file attaches to the current node, but uploading multiple files
			 * creates each file on it's own subnode (child nodes)
			 */
			// boolean addAsChildren = countFileUploads(uploadFiles) > 1;

			/*
			 * NEW LOGIC: If the node itself currently has an attachment, leave it alone and just upload
			 * UNDERNEATH this current node.
			 */
			final SubNode node = read.getNode(session, nodeId);
			if (node == null) {
				throw ExUtil.wrapEx("Node not found.");
			}

			auth.ownerAuth(node);

			final int maxFileSize = userManagerService.getMaxUploadSize(session);
			int imageCount = 0;

			/*
			 * if uploading multiple files check quota first, to make sure there's space for all files before we
			 * start uploading any of them If there's only one file, the normal flow will catch an out of space
			 * problem, so we don't need to do it in advance in here as we do for multiple file uploads only
			 */
			if (uploadFiles.length > 1) {
				final SubNode userNode = read.getUserNodeByUserName(null, null);

				// get how many bytes of storage the user currently holds
				Long binTotal = userNode.getIntProp(NodeProp.BIN_TOTAL.s());
				if (binTotal == null) {
					binTotal = 0L;
				}

				// get max amount user is allowed
				final Long userQuota = userNode.getIntProp(NodeProp.BIN_QUOTA.s());

				for (final MultipartFile uploadFile : uploadFiles) {
					binTotal += uploadFile.getSize();

					// check if user went over max and fail the API call if so.
					if (binTotal > userQuota) {
						throw new OutOfSpaceException();
					}
				}
			}

			for (final MultipartFile uploadFile : uploadFiles) {
				final String fileName = uploadFile.getOriginalFilename();
				final String contentType = uploadFile.getContentType();
				if (contentType.startsWith("image/")) {
					imageCount++;
				}

				final long size = uploadFile.getSize();
				if (!StringUtils.isEmpty(fileName)) {
					// log.debug("Uploading file: " + fileName + " contentType=" + contentType);

					final LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);

					// attaches AND closes the stream.
					attachBinaryFromStream(session, binSuffix, node, nodeId, fileName, size, limitedIs, contentType, -1, -1,
							addAsChildren, explodeZips, toIpfs, true, false, true, true, null);
				}
			}

			// if we have enough images to lay it out into a square of 3 cols switch to that
			// layout
			if (imageCount >= 9) {
				node.setProp(NodeProp.LAYOUT.s(), "c3");
			}
			// otherwise, if we have enough images to lay it out into a square of 2 cols
			// switch to that layout.
			else if (imageCount >= 2) {
				node.setProp(NodeProp.LAYOUT.s(), "c2");
			}

			update.saveSession(session);
		} catch (final Exception e) {
			throw ExUtil.wrapEx(e);
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}

	/*
	 * Gets the binary attachment from a supplied stream and loads it into the repository on the node
	 * specified in 'nodeId'
	 */
	public void attachBinaryFromStream(final MongoSession session, final String binSuffix, SubNode node, final String nodeId,
			final String fileName, final long size, final LimitedInputStreamEx is, String mimeType, final int width,
			final int height, final boolean addAsChild, final boolean explodeZips, final boolean toIpfs,
			final boolean calcImageSize, final boolean dataUrl, final boolean closeStream, boolean storeLocally,
			String sourceUrl) {

		/*
		 * If caller already has 'node' it can pass node, and avoid looking up node again
		 */
		if (node == null && nodeId != null) {
			node = read.getNode(session, nodeId);
		}

		/*
		 * Multiple file uploads always attach children for each file uploaded
		 */
		if (addAsChild) {
			auth.auth(session, node, PrivilegeType.WRITE);
			try {
				final SubNode newNode =
						create.createNode(session, node, null, null, null, CreateNodeLocation.LAST, null, null, true);
				newNode.setContent(fileName);
				newNode.touch();

				/*
				 * Note: Since the parent node we're creating under might have a "pending" path (unsaved), which is
				 * a path starting withi /r/p/ we have to set this new node to NON pending to change it. It's ok if
				 * the user abandons and never saves because this node will get orpaned if it's parent does so we
				 * don't need to worry about pending path for this one, and just can go with non-pending for the
				 * correct safe behavior
				 */
				util.setPendingPath(newNode, false);

				update.save(session, newNode);
				node = newNode;
			} catch (final Exception ex) {
				throw ExUtil.wrapEx(ex);
			}
		}
		else {
			auth.ownerAuth(node);
		}

		/* mimeType can be passed as null if it's not yet determined */
		if (mimeType == null) {
			mimeType = getBestMimeFromFileTypeName(fileName);
		}

		if (explodeZips && "application/zip".equalsIgnoreCase(mimeType)) {
			/*
			 * This is a prototype-scope bean, with state for processing one import at a time
			 */
			final ImportZipService importZipStreamService = (ImportZipService) SpringContextUtil.getBean(ImportZipService.class);
			importZipStreamService.importFromStream(session, is, node, false);
		} else {
			saveBinaryStreamToNode(session, binSuffix, is, mimeType, fileName, size, width, height, node, toIpfs, calcImageSize,
					dataUrl, closeStream, storeLocally, sourceUrl);
		}
	}

	public String getBestMimeFromFileTypeName(String fileName) {
		String mimeType = null;

		/* mimeType can be passed as null if it's not yet determined */
		if (mimeType == null) {
			mimeType = URLConnection.guessContentTypeFromName(fileName);
		}

		if (mimeType == null) {
			String ext = FilenameUtils.getExtension(fileName);
			mimeType = MimeTypeUtils.getMimeType(ext);
		}

		/* fallback to at lest some acceptable mime type */
		if (mimeType == null) {
			mimeType = "application/octet-stream";
		}

		return mimeType;
	}

	public void saveBinaryStreamToNode(final MongoSession session, final String binSuffix, final LimitedInputStreamEx inputStream,
			final String mimeType, final String fileName, final long size, final int width, final int height, final SubNode node,
			final boolean toIpfs, final boolean calcImageSize, final boolean dataUrl, final boolean closeStream,
			boolean storeLocally, String sourceUrl) {
		/*
		 * NOTE: Setting this flag to false works just fine, and is more efficient, and will simply do
		 * everything EXCEPT calculate the image size
		 */
		BufferedImage bufImg = null;
		byte[] imageBytes = null;
		InputStream isTemp = null;

		final int maxFileSize = userManagerService.getMaxUploadSize(session);

		/*
		 * Clear out any pre-existing binary properties
		 */
		deleteAllBinaryProperties(node, binSuffix);

		// log.debug("Node JSON after BIN props removed: " + XString.prettyPrint(node));

		if (ImageUtil.isImageMime(mimeType)) {

			// default image to be 100% size
			if (node.getStrProp(NodeProp.IMG_SIZE.s() + binSuffix) == null) {
				node.setProp(NodeProp.IMG_SIZE.s() + binSuffix, "100%");
			}

			if (calcImageSize) {
				LimitedInputStream is = null;
				try {
					is = new LimitedInputStreamEx(inputStream, maxFileSize);
					imageBytes = IOUtils.toByteArray(is);
					isTemp = new ByteArrayInputStream(imageBytes);
					bufImg = ImageIO.read(isTemp);

					try {
						node.setProp(NodeProp.IMG_WIDTH.s() + binSuffix, bufImg.getWidth());
						node.setProp(NodeProp.IMG_HEIGHT.s() + binSuffix, bufImg.getHeight());
					} catch (final Exception e) {
						/*
						 * reading files from IPFS caused this exception, and I didn't investigate why yet, because I don't
						 * think it's a bug in my code, but something in IPFS.
						 */
						log.error("Failed to get image length.", e);
					}
				} catch (final Exception e) {
					throw new RuntimeEx(e);
				} finally {
					if (closeStream) {
						StreamUtil.close(is, isTemp);
					}
				}
			}
		}

		node.setProp(NodeProp.BIN_MIME.s() + binSuffix, mimeType);

		if (dataUrl) {
			node.setProp(NodeProp.BIN_DATA_URL.s() + binSuffix, "t"); // t=true
		}

		SubNode userNode = read.getNode(session, node.getOwner());

		if (imageBytes == null) {
			try {
				node.setProp(NodeProp.BIN_SIZE.s() + binSuffix, size);
				if (toIpfs) {
					writeStreamToIpfs(session, binSuffix, node, inputStream, mimeType, userNode);
				} else {
					if (storeLocally) {
						if (fileName != null) {
							node.setProp(NodeProp.BIN_FILENAME.s() + binSuffix, fileName);
						}
						writeStream(session, binSuffix, node, inputStream, fileName, mimeType, userNode);
					} else {
						node.setProp(NodeProp.BIN_URL.s() + binSuffix, sourceUrl);
					}
				}
			} finally {
				if (closeStream) {
					StreamUtil.close(inputStream);
				}
			}
		} else {
			LimitedInputStreamEx is = null;
			try {
				node.setProp(NodeProp.BIN_SIZE.s() + binSuffix, imageBytes.length);

				if (storeLocally) {
					if (fileName != null) {
						node.setProp(NodeProp.BIN_FILENAME.s() + binSuffix, fileName);
					}
					is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
					if (toIpfs) {
						writeStreamToIpfs(session, binSuffix, node, is, mimeType, userNode);
					} else {
						writeStream(session, binSuffix, node, is, fileName, mimeType, userNode);
					}
				} else {
					node.setProp(NodeProp.BIN_URL.s() + binSuffix, sourceUrl);
				}
			} finally {
				StreamUtil.close(is);
			}
		}

		// MongoThreadLocal.clearDirtyNodes();
		update.save(session, node);
	}

	/*
	 * Removes the attachment from the node specified in the request.
	 */
	public DeleteAttachmentResponse deleteAttachment(MongoSession session, final DeleteAttachmentRequest req) {
		final DeleteAttachmentResponse res = new DeleteAttachmentResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		final String nodeId = req.getNodeId();
		final SubNode node = read.getNode(session, nodeId);
		auth.ownerAuth(node);
		deleteBinary(session, "", node, null);
		deleteAllBinaryProperties(node, "");
		update.saveSession(session);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Deletes all the binary-related properties from a node
	 */
	public void deleteAllBinaryProperties(final SubNode node, final String binSuffix) {
		node.deleteProp(NodeProp.IMG_WIDTH.s() + binSuffix);
		node.deleteProp(NodeProp.IMG_HEIGHT.s() + binSuffix);
		node.deleteProp(NodeProp.BIN_MIME.s() + binSuffix);
		node.deleteProp(NodeProp.BIN_FILENAME.s() + binSuffix);
		node.deleteProp(NodeProp.BIN_SIZE.s() + binSuffix);
		node.deleteProp(NodeProp.BIN.s() + binSuffix);
		node.deleteProp(NodeProp.BIN_URL.s() + binSuffix);
		node.deleteProp(NodeProp.BIN_DATA_URL.s() + binSuffix);
		node.deleteProp(NodeProp.IPFS_LINK.s() + binSuffix);
		node.deleteProp(NodeProp.IPFS_REF.s() + binSuffix);
	}

	/**
	 * Returns data for an attachment (Could be an image request, or any type of request for binary data
	 * from a node). This is the method that services all calls from the browser to get the data for the
	 * attachment to download/display the attachment.
	 * 
	 * the saga continues, after switching to InputStreamResouce images fail always with this error in
	 * js console::
	 * 
	 * InputStream has already been read - do not use InputStreamResource if a stream needs to be read
	 * multiple times
	 * 
	 * I stopped using this method (for now) because of this error, which is a Spring problem and not in
	 * my code. I created the simpler getBinary() version (below) which works find AND is simpler.
	 * 
	 * If 'download' is true we send back a "Content-Disposition: attachment;" rather than the default
	 * of "inline" by omitting it
	 * 
	 * node can be passed in -or- nodeId. If node is passed nodeId can be null.
	 */
	public void getBinary(MongoSession session, String binSuffix, SubNode node, String nodeId, final boolean download,
			final HttpServletResponse response) {
		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			if (node == null) {
				node = read.getNode(session, nodeId, false);
			} else {
				nodeId = node.getId().toHexString();
			}

			if (node == null) {
				throw ExUtil.wrapEx("node not found.");
			}

			final boolean ipfs = StringUtils.isNotEmpty(node.getStrProp(NodeProp.IPFS_LINK.s() + binSuffix));

			// Everyone's account node can publish it's attachment and is assumed to be an
			// avatar.
			boolean allowAuth = true;
			if (auth.isAnAccountNode(session, node)) {
				allowAuth = false;
			}

			if (allowAuth) {
				auth.auth(session, node, PrivilegeType.READ);
			}

			final String mimeTypeProp = node.getStrProp(NodeProp.BIN_MIME.s() + binSuffix);
			if (mimeTypeProp == null) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStrProp(NodeProp.BIN_FILENAME.s() + binSuffix);
			if (fileName == null) {
				fileName = "filename";
			}

			final InputStream is = getStream(session, binSuffix, node, allowAuth);
			final long size = node.getIntProp(NodeProp.BIN_SIZE.s() + binSuffix);
			log.debug("Getting Binary for nodeId=" + nodeId + " size=" + size);

			response.setContentType(mimeTypeProp);

			/*
			 * we gracefully tolerate the case where no size is available but normally it will be there.
			 * 
			 * todo-2: when we detect this and then stream back some data should be just go ahead and SET the
			 * correct 'size' on the node at that point?
			 */
			if (size > 0) {
				/*
				 * todo-2: I'm getting the "disappearing image" (from the browser) network problem related to size
				 * (content length), but not calling 'contentLength()' below is a workaround.
				 * 
				 * You get this error if you just wait about 30s to 1 minute, and maybe scroll out of view and back
				 * into view the images. What happens is the image loads just fine but then some background thread
				 * in Chrome looks at content lengths and finds some thing off somehoe and decides to make the image
				 * just disappear and show a broken link icon instead.
				 * 
				 * SO... I keep having to come back and remove the setContentLength every time I think this problem
				 * is resolved and then later find out it isn't. Somehow this is *currently* only happening for
				 * images that are served up from IPFS storage.
				 * 
				 * Chrome shows this: Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH
				 */
				if (!ipfs) {
					response.setContentLength((int) size);
				}
			}

			if (download) {
				response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
			}

			// This is max allowed caching time, and is 1 year in seconds
			response.setHeader("Cache-Control", "public, max-age=31536000");

			inStream = new BufferedInputStream(is);
			outStream = new BufferedOutputStream(response.getOutputStream());

			IOUtils.copy(inStream, outStream);
			outStream.flush();
		} catch (final Exception e) {
			log.error(e.getMessage());
		} finally {
			StreamUtil.close(inStream, outStream);
		}
	}

	/**
	 * Downloads a file by name that is expected to be in the Admin Data Folder
	 */
	public void getFile(final MongoSession session, final String fileName, String disposition,
			final HttpServletResponse response) {

		if (fileName.contains(".."))
			throw ExUtil.wrapEx("bad request.");

		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			final String fullFileName = appProp.getAdminDataFolder() + File.separator + fileName;
			final File file = new File(fullFileName);
			final String checkPath = file.getCanonicalPath();

			if (!checkPath.startsWith(appProp.getAdminDataFolder()))
				throw ExUtil.wrapEx("bad request.");

			if (!file.isFile())
				throw ExUtil.wrapEx("file not found.");

			final String mimeType = MimeTypeUtils.getMimeType(file);
			if (disposition == null) {
				disposition = "inline";
			}

			response.setContentType(mimeType);
			response.setContentLength((int) file.length());
			response.setHeader("Content-Disposition", disposition + "; filename=\"" + fileName + "\"");

			// This is max allowed caching time, and is 1 year in seconds
			response.setHeader("Cache-Control", "public, max-age=31536000");

			final FileInputStream is = new FileInputStream(fullFileName);
			inStream = new BufferedInputStream(is);
			outStream = new BufferedOutputStream(response.getOutputStream());

			IOUtils.copy(inStream, outStream);
			outStream.flush();
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(inStream, outStream);
		}
	}

	public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(final MongoSession session, final String nodeId,
			String disposition) {
		if (!session.isAdmin()) {
			throw new RuntimeEx("unauthorized");
		}

		try {
			final SubNode node = read.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeEx("node not found: " + nodeId);
			}
			final String fullFileName = node.getStrProp(NodeProp.FS_LINK);
			final File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeEx("File not found: " + fullFileName);
			}

			final String mimeType = MimeTypeUtils.getMimeType(file);
			if (disposition == null) {
				disposition = "inline";
			}

			/*
			 * I think we could be using the MultipartFileSender here, eventually but not until we decople it
			 * from reading directly from filesystem
			 */
			final AutoCloseInputStream acis = new AutoCloseInputStream(new FileInputStream(fullFileName));

			/*
			 * I'm not sure if FileSystemResource is better than StreamingResponseBody, but i do know
			 * StreamingResponseBody does EXACTLY what is needed which is to use a small buffer size and never
			 * hold entire media file all in memory
			 */
			final StreamingResponseBody stream = (os) -> {
				IOUtils.copy(acis, os);
				os.flush();
			};

			return ResponseEntity.ok()//
					.contentLength(file.length())//
					.header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + file.getName() + "\"")//
					.contentType(MediaType.parseMediaType(mimeType))//
					.body(stream);
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	public void getFileSystemResourceStreamMultiPart(final MongoSession session, final String nodeId, final String disposition,
			final HttpServletRequest request, final HttpServletResponse response) {
		try {
			final SubNode node = read.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeEx("node not found: " + nodeId);
			}

			auth.auth(session, node, PrivilegeType.READ);

			final String fullFileName = node.getStrProp(NodeProp.FS_LINK);
			final File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeEx("File not found: " + fullFileName);
			}

			MultipartFileSender.fromPath(file.toPath()).with(request).with(response).withDisposition(disposition).serveResource();
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	/**
	 * Returns the seekable stream of the attachment data (assuming it's a streamable media type, like
	 * audio or video)
	 */
	public void getStreamMultiPart(MongoSession session, final String nodeId, final String disposition,
			final HttpServletRequest request, final HttpServletResponse response) {
		BufferedInputStream inStream = null;

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			final SubNode node = read.getNode(session, nodeId, false);
			auth.auth(session, node, PrivilegeType.READ);

			final String mimeTypeProp = node.getStrProp(NodeProp.BIN_MIME.s());
			if (mimeTypeProp == null) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStrProp(NodeProp.BIN_FILENAME.s());
			if (fileName == null) {
				fileName = "filename";
			}

			final InputStream is = getStream(session, "", node, true);
			final long size = node.getIntProp(NodeProp.BIN_SIZE.s());

			if (size == 0) {
				throw new RuntimeEx("Can't stream video without the file size. BIN_SIZE property missing");
			}

			inStream = new BufferedInputStream(is);

			MultipartFileSender.fromInputStream(inStream)//
					.with(request).with(response)//
					.withDisposition(disposition)//
					.withFileName("file-" + node.getId().toHexString())//
					.withLength(size)//
					.withContentType(mimeTypeProp) //
					.withLastModified(node.getModifyTime().getTime())//
					.serveResource();
		} catch (final Exception e) {
			log.error(e.getMessage());
		}
	}

	/*
	 * Uploads an attachment not from the user's machine but from some arbitrary internet URL they have
	 * provided, that could be pointing to an image or any other kind of content actually.
	 */
	public UploadFromUrlResponse readFromUrl(final MongoSession session, final UploadFromUrlRequest req) {
		final UploadFromUrlResponse res = new UploadFromUrlResponse();
		readFromUrl(session, req.getSourceUrl(), req.getNodeId(), null, 0, req.isStoreLocally());
		res.setSuccess(true);
		return res;
	}

	public UploadFromIPFSResponse attachFromIPFS(final MongoSession session, final UploadFromIPFSRequest req) {
		final UploadFromIPFSResponse res = new UploadFromIPFSResponse();
		if (req.getNodeId() == null) {
			throw new RuntimeException("null nodeId");
		}

		SubNode node = read.getNode(session, req.getNodeId());
		if (node == null) {
			throw new RuntimeException("node not found: id=" + req.getNodeId());
		}

		auth.ownerAuth(node);
		node.setProp(NodeProp.IPFS_LINK.s(), req.getCid().trim());
		String mime = req.getMime().trim().replace(".", "");

		// If an extension was given (not a mime), then use it to make a filename, and
		// generate the mime from it.
		if (!mime.contains("/")) {
			node.setProp(NodeProp.BIN_FILENAME.s(), "file." + mime);
			mime = MimeTypeUtils.getMimeType(mime);
		}

		node.setProp(NodeProp.BIN_MIME.s(), mime);
		update.save(session, node);
		res.setSuccess(true);
		return res;
	}

	/**
	 * @param mimeHint This is an additional string invented because IPFS urls don't contain the file
	 *        extension always and in that case we need to get it from the IPFS filename itself and
	 *        that's what the hint is in that case. Normally however mimeHint is null
	 * 
	 *        'inputStream' is admittely a retrofit to this function for when we want to just call this
	 *        method and get an inputStream handed back that can be read from. Normally the inputStream
	 *        ValContainer is null and not used.
	 */
	public void readFromUrl(final MongoSession session, final String sourceUrl, final String nodeId, final String mimeHint,
			final int maxFileSize, boolean storeLocally) {
		if (sourceUrl.startsWith("data:")) {
			readFromDataUrl(session, sourceUrl, nodeId, mimeHint, maxFileSize);
		} else {
			readFromStandardUrl(session, sourceUrl, nodeId, mimeHint, maxFileSize, storeLocally);
		}
	}

	public void readFromDataUrl(MongoSession session, final String sourceUrl, final String nodeId, final String mimeHint,
			int maxFileSize) {
		if (maxFileSize <= 0) {
			maxFileSize = userManagerService.getMaxUploadSize(session);
		}

		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		final String mimeType = Util.getMimeFromDataUrl(sourceUrl);

		if (ImageUtil.isImageMime(mimeType)) {
			final InputStream is = new ByteArrayInputStream(sourceUrl.getBytes());
			final LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(is, maxFileSize);

			// insert 0L for size now, because we don't know it yet
			attachBinaryFromStream(session, "", null, nodeId, "data-url", 0L, limitedIs, mimeType, -1, -1, false, false, false,
					false, true, true, true, sourceUrl);
		} else {
			throw new RuntimeEx("Unsupported inline data type.");
		}
	}

	// https://tools.ietf.org/html/rfc2397
	public void readFromStandardUrl(MongoSession session, final String sourceUrl, final String nodeId, final String mimeHint,
			int maxFileSize, boolean storeLocally) {

		if (!storeLocally) {
			SubNode node = read.getNode(session, nodeId);
			auth.ownerAuth(node);

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && mimeHint != null) {
				mimeType = URLConnection.guessContentTypeFromName(mimeHint);
			}

			if (mimeType != null) {
				node.setProp(NodeProp.BIN_MIME.s(), mimeType);
			}
			node.setProp(NodeProp.BIN_URL.s(), sourceUrl);
			update.saveSession(session);
			return;
		}

		if (maxFileSize <= 0) {
			maxFileSize = userManagerService.getMaxUploadSize(session);
		}

		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		LimitedInputStreamEx limitedIs = null;

		try {
			final URL url = new URL(sourceUrl);
			final int timeout = 20;
			final RequestConfig config = RequestConfig.custom()//
					.setConnectTimeout(timeout * 1000) //
					.setConnectionRequestTimeout(timeout * 1000) //
					.setSocketTimeout(timeout * 1000).build();

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && mimeHint != null) {
				mimeType = URLConnection.guessContentTypeFromName(mimeHint);
			}

			/*
			 * if this is an image extension, handle it in a special way, mainly to extract the width, height
			 * from it
			 */
			if (ImageUtil.isImageMime(mimeType)) {

				/*
				 * DO NOT DELETE
				 *
				 * Basic version without masquerading as a web browser can cause a 403 error because some sites
				 * don't want just any old stream reading from them. Leave this note here as a warning and
				 * explanation
				 */

				// would restTemplate be better for this ?
				final HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
				final HttpGet request = new HttpGet(sourceUrl);

				request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
				final HttpResponse response = client.execute(request);
				log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
						+ response.getStatusLine().getReasonPhrase());
				final InputStream is = response.getEntity().getContent();

				limitedIs = new LimitedInputStreamEx(is, maxFileSize);

				// insert 0L for size now, because we don't know it yet
				attachBinaryFromStream(session, "", null, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false, false, false,
						true, false, true, storeLocally, sourceUrl);
			}
			/*
			 * if not an image extension, we can just stream directly into the database, but we want to try to
			 * get the mime type first, from calling detectImage so that if we do detect its an image we can
			 * handle it as one.
			 */
			else {
				if (!detectAndSaveImage(session, nodeId, sourceUrl, url, storeLocally)) {
					final HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
					final HttpGet request = new HttpGet(sourceUrl);
					request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
					final HttpResponse response = client.execute(request);
					/*
					 * log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason=" +
					 * response.getStatusLine().getReasonPhrase());
					 */
					final InputStream is = response.getEntity().getContent();
					limitedIs = new LimitedInputStreamEx(is, maxFileSize);

					// insert 0L for size now, because we don't know it yet
					attachBinaryFromStream(session, "", null, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false, false, false,
							true, false, true, storeLocally, sourceUrl);
				}
			}
		} catch (final Exception e) {
			throw ExUtil.wrapEx(e);
		}
		/* finally block just for extra safety */
		finally {
			// this stream will have been closed by 'attachBinaryFromStream' but we close
			// here too anyway.
			StreamUtil.close(limitedIs);
		}

		update.saveSession(session);
	}

	// FYI: Warning: this way of getting content type doesn't work.
	// String mimeType = URLConnection.guessContentTypeFromStream(inputStream);
	//
	/* returns true if it was detected AND saved as an image */
	private boolean detectAndSaveImage(final MongoSession session, final String nodeId, final String sourceUrl, final URL url,
			boolean storeLocally) {
		ImageInputStream is = null;
		LimitedInputStreamEx is2 = null;
		ImageReader reader = null;
		final int maxFileSize = 20 * 1024 * 1024;

		try {
			is = ImageIO.createImageInputStream(url.openStream());
			final Iterator<ImageReader> readers = ImageIO.getImageReaders(is);

			if (readers.hasNext()) {
				reader = readers.next();
				String formatName = reader.getFormatName();

				if (formatName != null) {
					formatName = formatName.toLowerCase();
					// log.debug("determined format name of image url: " + formatName);
					reader.setInput(is, true, false);
					final String mimeType = "image/" + formatName;

					final BufferedImage bufImg = reader.read(0);
					final ByteArrayOutputStream os = new ByteArrayOutputStream();
					ImageIO.write(bufImg, formatName, os);
					final byte[] bytes = os.toByteArray();
					is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);

					attachBinaryFromStream(session, "", null, nodeId, sourceUrl, bytes.length, is2, mimeType,
							bufImg.getWidth(null), bufImg.getHeight(null), false, false, false, true, false, true, storeLocally,
							sourceUrl);

					return true;
				}
			}
		} catch (final Exception e) {
			throw ExUtil.wrapEx(e);
		} finally {
			StreamUtil.close(is, is2, reader);
		}

		return false;
	}

	public void writeStream(final MongoSession session, final String binSuffix, final SubNode node,
			final LimitedInputStreamEx stream, final String fileName, final String mimeType, SubNode userNode) {

		auth.ownerAuth(node);
		final DBObject metaData = new BasicDBObject();
		metaData.put("nodeId" + binSuffix, node.getId());

		if (userNode == null) {
			userNode = read.getUserNodeByUserName(null, null);
		}

		/*
		 * Delete any existing grid data stored under this node, before saving new attachment
		 */
		deleteBinary(session, binSuffix, node, userNode);

		// #saveAsPdf work in progress:
		// todo-2: right here if saveAsPdf is true we need to convert the HTML to PDF
		// and write that stream.
		// read stream into html as a string.
		// create new outputstream (in memory) to write to (byte array stream)
		// PdfConverterExtension.exportToPdf(out, html, "", options);
		// get an inputstream that reads what was written, and put it in 'stream',
		// then the rest fo the code remains as is.

		final String id = grid.store(stream, fileName, mimeType, metaData).toString();

		final long streamCount = stream.getCount();
		// log.debug("upload streamCount=" + streamCount);

		// update the user quota which enforces their total storage limit
		if (!session.isAdmin()) {
			userManagerService.addBytesToUserNodeBytes(streamCount, userNode, 1);
		}

		if (userNode == null) {
			throw new RuntimeEx("User not found.");
		}

		/*
		 * Now save the node also since the property on it needs to point to GridFS id
		 */
		node.setProp(NodeProp.BIN.s() + binSuffix, new SubNodePropVal(id));
		node.setProp(NodeProp.BIN_SIZE.s() + binSuffix, streamCount);
	}

	public void writeStreamToIpfs(final MongoSession session, final String binSuffix, final SubNode node,
			final InputStream stream, final String mimeType, SubNode userNode) {
		auth.ownerAuth(node);
		final ValContainer<Integer> streamSize = new ValContainer<>();

		MerkleLink ret = ipfsService.addFromStream(session, stream, null, mimeType, streamSize, null, false);
		if (ret != null) {
			node.setProp(NodeProp.IPFS_LINK.s() + binSuffix, ret.getHash());
			// NOTE: Lack of the REF property indicated we store internally (pinned file)
			// node.setProp(NodeProp.IPFS_REF.s() + binSuffix, "0");
			node.setProp(NodeProp.BIN_SIZE.s() + binSuffix, streamSize.getVal());

			/* consume user quota space */
			userManagerService.addBytesToUserNodeBytes(streamSize.getVal(), userNode, 1);
		}
	}

	public void deleteBinary(final MongoSession session, final String binSuffix, final SubNode node, SubNode userNode) {
		auth.ownerAuth(node);
		final String id = node.getStrProp(NodeProp.BIN.s() + binSuffix);
		if (id == null) {
			return;
		}

		if (!session.isAdmin()) {
			/*
			 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
			 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
			 * deducted from
			 */
			userManagerService.addNodeBytesToUserNodeBytes(node, userNode, -1);
		}

		grid.delete(new Query(Criteria.where("_id").is(id)));
	}

	/*
	 * Gets the binary data attachment stream from the node regardless of wether it's from IPFS_LINK or
	 * BIN
	 */
	public InputStream getStream(final MongoSession session, String binSuffix, final SubNode node, final boolean _auth) {
		if (_auth) {
			auth.auth(session, node, PrivilegeType.READ);
		}

		InputStream is = null;
		String ipfsHash = node.getStrProp(NodeProp.IPFS_LINK.s() + binSuffix);
		if (ipfsHash != null) {
			// log.debug("Getting IPFS Stream: hash=" + ipfsHash);
			is = ipfsService.getStream(session, ipfsHash);
		} else {
			is = getStreamByNode(node, binSuffix);
		}
		return is;
	}

	public InputStream getStreamByNode(final SubNode node, String binSuffix) {
		if (node == null)
			return null;
		log.debug("getStreamByNode: " + node.getId().toHexString());

		String id = node.getStrProp(NodeProp.BIN.s() + binSuffix);
		if (id == null) {
			return null;
		}

		/* why not an import here? */
		final com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(id)));
		// new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (gridFile == null) {
			log.debug("gridfs ID not found");
			return null;
		}

		final GridFsResource gridFsResource =
				new GridFsResource(gridFile, gridFsBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			final InputStream is = gridFsResource.getInputStream();
			if (is == null) {
				throw new RuntimeEx("Unable to get inputStream");
			}
			return is;
		} catch (final Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	public String getStringByNode(final MongoSession session, final SubNode node) {
		String ret = null;
		if (node != null) {
			auth.auth(session, node, PrivilegeType.READ);
			ret = getStringByNodeEx(node);
		}
		return ret;
	}

	/* Gets the content of the grid resource by reading it into a string */
	public String getStringByNodeEx(final SubNode node) {
		if (node == null)
			return null;
		log.debug("getStringByNode: " + node.getId().toHexString());

		final String id = node.getStrProp("bin");
		if (id == null) {
			return null;
		}

		final com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(id)));
		// new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (gridFile == null) {
			log.debug("gridfs ID not found");
			return null;
		}

		final GridFsResource gridFsResource =
				new GridFsResource(gridFile, gridFsBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			final InputStream is = gridFsResource.getInputStream();
			if (is == null) {
				throw new RuntimeEx("Unable to get inputStream");
			}
			final String result = IOUtils.toString(is, StandardCharsets.UTF_8.name());
			return result;
		} catch (final Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	public int getGridItemCount() {
		return adminRunner.run(session -> {
			int count = 0;
			final GridFSFindIterable files = gridFsBucket.find();

			/* Scan all files in the grid */
			if (files != null) {
				/*
				 * I am needing this quick and didn't find another way to do this other than brute force scan. Maybe
				 * they are using a linked list so that there genuinely is no faster way ?
				 */
				for (final GridFSFile file : files) {
					count++;
				}
			}
			return Integer.valueOf(count);
		});
	}

	/**
	 * This method makes a single pass over all grid items doing all the daily maintenance on each one
	 * as necessary to maintain the system health and statistics.
	 * 
	 * Scans all the uploaded attachments, and finds any that aren't owned by some SubNode, and deletes
	 * them.
	 * 
	 * Also keeps totals by each user account, in a hashmap to be written all out at the end to all the
	 * nodes.
	 */
	public void gridMaintenanceScan(HashMap<ObjectId, UserStats> statsMap) {
		adminRunner.run(session -> {
			int delCount = 0;
			final GridFSFindIterable files = gridFsBucket.find();

			/* Scan all files in the grid */
			if (files != null) {
				for (final GridFSFile file : files) {
					final Document meta = file.getMetadata();
					if (meta != null) {
						/* Get which nodeId owns this grid file */
						ObjectId id = (ObjectId) meta.get("nodeId");

						/*
						 * If the grid file is not based off 'nodeId' then we still need to check if it's a Header image
						 * (special case)
						 */
						if (id == null) {
							/*
							 * todo-2: currently we only have "Header" as a (binSuffix), and it may stay that way forever, as
							 * the only violation of the one-binary-per-node rule.
							 * 
							 * Actually we need a cleaner solution than having 'suffixed' versions of all binary properties.
							 * That was an ugly hack.
							 */
							id = (ObjectId) meta.get("nodeIdHeader");
						}

						if (id != null) {
							/* Find the node */
							final SubNode subNode = read.getNode(session, id);

							/*
							 * If the node doesn't exist then this grid file is an orphan and should go away
							 */
							if (subNode == null) {
								log.debug("Grid Orphan Delete: " + id.toHexString());

								// Query query = new Query(GridFsCriteria.where("_id").is(file.getId());
								final Query query = new Query(Criteria.where("_id").is(file.getId()));

								// Note: It's not a bug that we don't call this here:
								// userManagerService.addNodeBytesToUserNodeBytes(node, null, -1);
								// Because all the userstats are updated at the end of this scan.
								grid.delete(query);
								delCount++;
							}
							/*
							 * else update the UserStats by adding the file length to the total for this user
							 */
							else {
								UserStats stats = statsMap.get(subNode.getOwner());
								if (stats == null) {
									stats = new UserStats();
									stats.binUsage = file.getLength();
									statsMap.put(subNode.getOwner(), stats);
								} else {
									stats.binUsage = stats.binUsage.longValue() + file.getLength();
								}
							}
						}
					}
				}
			}

			final Iterable<SubNode> accountNodes =
					read.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null, null, 0, null, null);

			/*
			 * scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
			 * amount).
			 */
			for (final SubNode accountNode : accountNodes) {
				log.debug("Processing Account Node: id=" + accountNode.getId().toHexString());
				UserStats stats = statsMap.get(accountNode.getOwner());
				if (stats == null) {
					stats = new UserStats();
					stats.binUsage = 0L;
					statsMap.put(accountNode.getOwner(), stats);
				}
			}

			log.debug(String.valueOf(delCount) + " orphans found and deleted.");
			return null;
		});
	}
}
