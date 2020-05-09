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

import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.image.ImageUtil;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.request.DeleteAttachmentRequest;
import org.subnode.request.UploadFromUrlRequest;
import org.subnode.response.DeleteAttachmentResponse;
import org.subnode.response.UploadFromUrlResponse;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStream;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeTypeUtils;
import org.subnode.util.MultipartFileSender;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.Util;
import org.subnode.util.ValContainer;
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
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;

import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSFindIterable;
import com.mongodb.client.gridfs.model.GridFSFile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

/**
 * Service for managing node attachments.
 * 
 * Node attachments are binary attachments that the user can opload onto a node.
 * Each node allows either zero or one attachments. Uploading a new attachment
 * wipes out and replaces the previous attachment. If the attachment is an
 * 'image' type then it gets displayed right on the page. Otherwise a download
 * link is what gets displayed on the node.
 */
@Component
public class AttachmentService {
	private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	@Autowired
	private MimeTypeUtils mimeTypeUtils;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private GridFsTemplate grid;

	@Autowired
	private GridFSBucket gridFsBucket;

	@Autowired
	private IPFSService ipfsService;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	/*
	 * Upload from User's computer. Standard HTML form-based uploading of a file
	 * from user machine
	 */
	public ResponseEntity<?> uploadMultipleFiles(MongoSession session, String nodeId, MultipartFile[] uploadFiles,
			boolean explodeZips, boolean toIpfs) {
		if (nodeId == null) {
			throw ExUtil.wrapEx("target nodeId not provided");
		}

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			/*
			 * OLD LOGIC: Uploading a single file attaches to the current node, but
			 * uploading multiple files creates each file on it's own subnode (child nodes)
			 */
			// boolean addAsChildren = countFileUploads(uploadFiles) > 1;

			/*
			 * NEW LOGIC: If the node itself currently has an attachment, leave it alone and
			 * just upload UNDERNEATH this current node.
			 */
			SubNode node = api.getNode(session, nodeId);

			if (node == null) {
				throw ExUtil.wrapEx("Node not found.");
			}

			api.auth(session, node, PrivilegeType.WRITE);

			boolean addAsChildren = uploadFiles.length > 1;
			int maxFileSize = session.getMaxUploadSize();

			for (MultipartFile uploadFile : uploadFiles) {
				String fileName = uploadFile.getOriginalFilename();
				String contentType = uploadFile.getContentType();

				long size = uploadFile.getSize();
				if (!StringUtils.isEmpty(fileName)) {
					// log.debug("Uploading file: " + fileName + " contentType=" + contentType);

					LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);

					// attaches AND closes the stream.
					attachBinaryFromStream(session, node, nodeId, fileName, size, limitedIs, contentType, -1, -1,
							addAsChildren, explodeZips, toIpfs, true, false, true);
				}
			}
			api.saveSession(session);
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}

	/*
	 * Gets the binary attachment from a supplied stream and loads it into the
	 * repository on the node specified in 'nodeId'
	 */
	public void attachBinaryFromStream(MongoSession session, SubNode node, String nodeId, String fileName, long size,
			LimitedInputStreamEx is, String mimeType, int width, int height, boolean addAsChild, boolean explodeZips,
			boolean toIpfs, boolean calcImageSize, boolean dataUrl, boolean closeStream) {

		/*
		 * If caller already has 'node' it can pass node, and avoid looking up node
		 * again
		 */
		if (node == null && nodeId != null) {
			node = api.getNode(session, nodeId);
		}

		api.auth(session, node, PrivilegeType.WRITE);

		/*
		 * Multiple file uploads always attach children for each file uploaded
		 */
		if (addAsChild) {
			try {
				SubNode newNode = api.createNode(session, node, null, null, null, CreateNodeLocation.LAST);
				newNode.setContent("### " + fileName);

				/*
				 * todo-1: saving multiple uploads isn't working right now. It's a work in
				 * progress. This isn't a bug, but just incomplete code.
				 */
				api.save(session, newNode);
				// api.saveSession(session);

				node = newNode;
			} catch (Exception ex) {
				throw ExUtil.wrapEx(ex);
			}
		}

		/* mimeType can be passed as null if it's not yet determined */
		if (mimeType == null) {
			mimeType = URLConnection.guessContentTypeFromName(fileName);
		}

		/*
		 * Hack/Fix for ms word. Not sure why the URLConnection fails for this, but it's
		 * new. I need to grab my old mime type map from legacy app and put in this
		 * project. Clearly the guessContentTypeFromName implementation provided by
		 * URLConnection has a screw loose.
		 */
		if (mimeType == null) {
			if (fileName.toLowerCase().endsWith(".doc")) {
				mimeType = "application/msword";
			}
		}

		/* fallback to at lest some acceptable mime type */
		if (mimeType == null) {
			mimeType = "application/octet-stream";
		}

		if (explodeZips && "application/zip".equalsIgnoreCase(mimeType)) {
			/*
			 * This is a prototype-scope bean, with state for processing one import at a
			 * time
			 */
			ImportZipService importZipStreamService = (ImportZipService) SpringContextUtil
					.getBean(ImportZipService.class);
			importZipStreamService.importFromStream(session, is, node, false);
		} else {
			saveBinaryStreamToNode(session, is, mimeType, fileName, size, width, height, node, toIpfs, calcImageSize,
					dataUrl, closeStream);
		}
	}

	public void saveBinaryStreamToNode(MongoSession session, LimitedInputStreamEx inputStream, String mimeType,
			String fileName, long size, int width, int height, SubNode node, boolean toIpfs, boolean calcImageSize,
			boolean dataUrl, boolean closeStream) {
		/*
		 * NOTE: Setting this flag to false works just fine, and is more efficient, and
		 * will simply do everything EXCEPT calculate the image size
		 */
		BufferedImage bufImg = null;
		byte[] imageBytes = null;
		InputStream isTemp = null;

		int maxFileSize = session.getMaxUploadSize();

		if (calcImageSize && ImageUtil.isImageMime(mimeType)) {
			LimitedInputStream is = null;
			try {
				is = new LimitedInputStreamEx(inputStream, maxFileSize);
				imageBytes = IOUtils.toByteArray(is);
				isTemp = new ByteArrayInputStream(imageBytes);
				bufImg = ImageIO.read(isTemp);

				try {
					node.setProp(NodeProp.IMG_WIDTH.s(), bufImg.getWidth());
					node.setProp(NodeProp.IMG_HEIGHT.s(), bufImg.getHeight());
				} catch (Exception e) {
					/*
					 * reading files from IPFS caused this exception, and I didn't investigate why
					 * yet, because I don't think it's a bug in my code, but something in IPFS.
					 */
					log.error("Failed to get image length.", e);
				}
			} catch (Exception e) {
				throw new RuntimeEx(e);
			} finally {
				if (closeStream) {
					StreamUtil.close(is, isTemp);
				}
			}
		}

		node.setProp(NodeProp.BIN_MIME.s(), mimeType);
		if (fileName != null) {
			node.setProp(NodeProp.BIN_FILENAME.s(), fileName);
		}

		if (dataUrl) {
			node.setProp(NodeProp.BIN_DATA_URL.s(), "t"); // t=true
		}

		if (imageBytes == null) {
			try {
				node.setProp(NodeProp.BIN_SIZE.s(), size);
				if (toIpfs) {
					writeStreamToIpfs(session, node, inputStream, mimeType);
				} else {
					writeStream(session, node, inputStream, fileName, mimeType);
				}
			} finally {
				if (closeStream) {
					StreamUtil.close(inputStream);
				}
			}
		} else {
			LimitedInputStreamEx is = null;
			try {
				node.setProp(NodeProp.BIN_SIZE.s(), imageBytes.length);
				is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
				if (toIpfs) {
					writeStreamToIpfs(session, node, is, mimeType);
				} else {
					writeStream(session, node, is, fileName, mimeType);
				}
			} finally {
				StreamUtil.close(is);
			}
		}

		api.save(session, node);
	}

	/*
	 * Removes the attachment from the node specified in the request.
	 */
	public DeleteAttachmentResponse deleteAttachment(MongoSession session, DeleteAttachmentRequest req) {
		DeleteAttachmentResponse res = new DeleteAttachmentResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		deleteBinary(session, node);
		deleteAllBinaryProperties(node);
		api.saveSession(session);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Deletes all the binary-related properties from a node
	 */
	public void deleteAllBinaryProperties(SubNode node) {
		node.deleteProp(NodeProp.IMG_WIDTH.s());
		node.deleteProp(NodeProp.IMG_HEIGHT.s());
		node.deleteProp(NodeProp.BIN_MIME.s());
		node.deleteProp(NodeProp.BIN_FILENAME.s());
		node.deleteProp(NodeProp.BIN_SIZE.s());
		node.deleteProp(NodeProp.BIN.s());
		node.deleteProp(NodeProp.BIN_DATA_URL.s());
		node.deleteProp(NodeProp.IPFS_LINK.s());
	}

	/**
	 * Returns data for an attachment (Could be an image request, or any type of
	 * request for binary data from a node). This is the method that services all
	 * calls from the browser to get the data for the attachment to download/display
	 * the attachment.
	 * 
	 * the saga continues, after switching to InputStreamResouce images fail always
	 * with this error in js console::
	 * 
	 * InputStream has already been read - do not use InputStreamResource if a
	 * stream needs to be read multiple times
	 * 
	 * I stopped using this method (for now) because of this error, which is a
	 * Spring problem and not in my code. I created the simpler getBinary() version
	 * (below) which works find AND is simpler.
	 */
	public ResponseEntity<InputStreamResource> getBinary_legacy(MongoSession session, String nodeId) {
		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			SubNode node = api.getNode(session, nodeId, false);
			boolean ipfs = StringUtils.isNotEmpty(node.getStringProp(NodeProp.IPFS_LINK.s()));

			// Everyone's account node can publish it's attachment and is assumed to be an
			// avatar.
			boolean allowAuth = true;
			if (api.isAnAccountNode(session, node)) {
				allowAuth = false;
			}

			if (allowAuth) {
				api.auth(session, node, PrivilegeType.READ);
			}

			String mimeTypeProp = node.getStringProp(NodeProp.BIN_MIME.s());
			if (mimeTypeProp == null) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStringProp(NodeProp.BIN_FILENAME.s());
			if (fileName == null) {
				fileName = "filename";
			}

			// I took out the autoClosing stream, and I'm not sure if it's needed based on
			// current design, since when it
			// was originally put here.
			// AutoCloseInputStream acis = api.getAutoClosingStream(session, node, null,
			// allowAuth, ipfs);
			// StreamingResponseBody stream = (os) -> {
			// int bytesCopied = IOUtils.copy(acis, os);
			// log.debug("io copy complete: bytes="+bytesCopied);
			// os.flush();
			// log.debug("flush complete.");
			// };

			InputStream is = getStream(session, node, allowAuth, ipfs);
			InputStreamResource isr = new InputStreamResource(is);

			long size = node.getIntProp(NodeProp.BIN_SIZE.s());
			log.debug("Getting Binary for nodeId=" + nodeId + " size=" + size);

			/*
			 * To make, for example an image type of resource DISPLAY in the browser (rather
			 * than a downloaded file), you'd need this to be omitted (or 'inline')
			 */
			ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
			if (size > 0) {
				/*
				 * todo-1: I'm getting the "disappearing image" network problem related to size
				 * (content length), but not calling 'contentLength()' below is a workaround.
				 * 
				 * You get this error if you just wait about 30s to 1 minute, and maybe scroll
				 * out of view and back into view the images.
				 * 
				 * Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH
				 */
				builder = builder.contentLength(size);
			}
			builder = builder.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"");
			builder = builder.contentType(MediaType.parseMediaType(mimeTypeProp));
			return builder.body(isr);
		} catch (Exception e) {
			log.error(e.getMessage());
			return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
		}
	}

	public void getBinary(MongoSession session, String nodeId, HttpServletResponse response) {
		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			SubNode node = api.getNode(session, nodeId, false);
			boolean ipfs = StringUtils.isNotEmpty(node.getStringProp(NodeProp.IPFS_LINK.s()));

			// Everyone's account node can publish it's attachment and is assumed to be an
			// avatar.
			boolean allowAuth = true;
			if (api.isAnAccountNode(session, node)) {
				allowAuth = false;
			}

			if (allowAuth) {
				api.auth(session, node, PrivilegeType.READ);
			}

			String mimeTypeProp = node.getStringProp(NodeProp.BIN_MIME.s());
			if (mimeTypeProp == null) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStringProp(NodeProp.BIN_FILENAME.s());
			if (fileName == null) {
				fileName = "filename";
			}

			InputStream is = getStream(session, node, allowAuth, ipfs);
			long size = node.getIntProp(NodeProp.BIN_SIZE.s());
			log.debug("Getting Binary for nodeId=" + nodeId + " size=" + size);

			response.setContentType(mimeTypeProp);

			/*
			 * we gracefully tolerate the case where no size is available but normally it
			 * will be there.
			 * 
			 * todo-1: when we detect this and then stream back some data shuld be just go
			 * ahead and SET the correct 'size' on the node at that point?
			 */
			if (size > 0) {
				/*
				 * todo-1: I'm getting the "disappearing image" network problem related to size
				 * (content length), but not calling 'contentLength()' below is a workaround.
				 * 
				 * You get this error if you just wait about 30s to 1 minute, and maybe scroll
				 * out of view and back into view the images. What happens is the image loads
				 * just fine but then some background thread in Chrome looks at content lengths
				 * and finds some thing off somehoe and decides to make the image just disappear
				 * and show a broken link icon instead.
				 * 
				 * SO... I keep having to come back and remove the setContentLength every time I
				 * think this problem is resolved and then later find out it isn't. Somehow this
				 * is *currently* only happening for images that are served up from IPFS
				 * storage.
				 * 
				 * Chrome shows this: Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH
				 */
				if (!ipfs) {
					response.setContentLength((int) size);
				}
			}
			response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
			response.setHeader("Cache-Control", "public, max-age=31536000");

			inStream = new BufferedInputStream(is);
			outStream = new BufferedOutputStream(response.getOutputStream());

			IOUtils.copy(inStream, outStream);
			outStream.flush();
		} catch (Exception e) {
			log.error(e.getMessage());
		} finally {
			StreamUtil.close(inStream, outStream);
		}
	}

	/**
	 * Downloads a file by name that is expected to be in the Admin Data Folder
	 */
	public void getFile(MongoSession session, String fileName, String disposition, HttpServletResponse response) {

		if (fileName.contains(".."))
			throw ExUtil.wrapEx("bad request.");

		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			String fullFileName = appProp.getAdminDataFolder() + File.separator + fileName;
			File file = new File(fullFileName);
			String checkPath = file.getCanonicalPath();
			/*
			 * todo-1: for better security make a REAL '/file/' folder under admin folder
			 * and assert that the file is in there directly
			 */
			if (!checkPath.startsWith(appProp.getAdminDataFolder()))
				throw ExUtil.wrapEx("bad request.");

			if (!file.isFile())
				throw ExUtil.wrapEx("file not found.");

			String mimeType = mimeTypeUtils.getMimeType(file);
			if (disposition == null) {
				disposition = "inline";
			}

			response.setContentType(mimeType);
			response.setContentLength((int) file.length());
			response.setHeader("Content-Disposition", disposition + "; filename=\"" + fileName + "\"");
			response.setHeader("Cache-Control", "public, max-age=31536000");

			FileInputStream is = new FileInputStream(fullFileName);
			inStream = new BufferedInputStream(is);
			outStream = new BufferedOutputStream(response.getOutputStream());

			IOUtils.copy(inStream, outStream);
			outStream.flush();
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(inStream, outStream);
		}
	}

	public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(MongoSession session, String nodeId,
			String disposition) {
		if (!session.isAdmin()) {
			throw new RuntimeEx("unauthorized");
		}

		try {
			SubNode node = api.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeEx("node not found: " + nodeId);
			}
			String fullFileName = node.getStringProp(NodeProp.FS_LINK);
			File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeEx("File not found: " + fullFileName);
			}

			String mimeType = mimeTypeUtils.getMimeType(file);
			if (disposition == null) {
				disposition = "inline";
			}

			/*
			 * I think we could be using the MultipartFileSender here, eventually but not
			 * until we decople it from reading directly from filesystem
			 */
			AutoCloseInputStream acis = new AutoCloseInputStream(new FileInputStream(fullFileName));

			/*
			 * I'm not sure if FileSystemResource is better than StreamingResponseBody, but
			 * i do know StreamingResponseBody does EXACTLY what is needed which is to use a
			 * small buffer size and never hold entire media file all in memory
			 */
			StreamingResponseBody stream = (os) -> {
				IOUtils.copy(acis, os);
				os.flush();
			};

			return ResponseEntity.ok()//
					.contentLength(file.length())//
					.header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + file.getName() + "\"")//
					.contentType(MediaType.parseMediaType(mimeType))//
					.body(stream);
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	public void getFileSystemResourceStreamMultiPart(MongoSession session, String nodeId, String disposition,
			HttpServletRequest request, HttpServletResponse response) {
		try {
			SubNode node = api.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeEx("node not found: " + nodeId);
			}

			api.auth(session, node, PrivilegeType.READ);

			String fullFileName = node.getStringProp(NodeProp.FS_LINK);
			File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeEx("File not found: " + fullFileName);
			}

			MultipartFileSender.fromPath(file.toPath()).with(request).with(response).withDisposition(disposition)
					.serveResource();
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	/**
	 * Returns the seekable stream of the attachment data (assuming it's a
	 * streamable media type, like audio or video)
	 */
	public void getStreamMultiPart(MongoSession session, String nodeId, String disposition, HttpServletRequest request,
			HttpServletResponse response) {
		BufferedInputStream inStream = null;

		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}

			SubNode node = api.getNode(session, nodeId, false);
			boolean ipfs = StringUtils.isNotEmpty(node.getStringProp(NodeProp.IPFS_LINK.s()));

			api.auth(session, node, PrivilegeType.READ);

			String mimeTypeProp = node.getStringProp(NodeProp.BIN_MIME.s());
			if (mimeTypeProp == null) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStringProp(NodeProp.BIN_FILENAME.s());
			if (fileName == null) {
				fileName = "filename";
			}

			InputStream is = getStream(session, null, true, ipfs);
			long size = node.getIntProp(NodeProp.BIN_SIZE.s());

			if (size == 0) {
				throw new RuntimeEx("Can't stream video without the file size. sn:size property missing");
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
		} catch (Exception e) {
			log.error(e.getMessage());
		} finally {
			// StreamUtil.close(inStream);
		}
	}

	/*
	 * Uploads an image attachment not from the user's machine but from some
	 * arbitrary internet URL they have provided, that could be pointing to an image
	 * or any other kind of content actually.
	 */
	public UploadFromUrlResponse readFromUrl(MongoSession session, UploadFromUrlRequest req) {
		UploadFromUrlResponse res = new UploadFromUrlResponse();
		readFromUrl(session, req.getSourceUrl(), req.getNodeId(), null, 0);
		res.setSuccess(true);
		return res;
	}

	/**
	 * @param mimeHint This is an additional string invented because IPFS urls don't
	 *                 contain the file extension always and in that case we need to
	 *                 get it from the IPFS filename itself and that's what the hint
	 *                 is in that case. Normally however mimeHint is null
	 * 
	 *                 'inputStream' is admittely a retrofit to this function for
	 *                 when we want to just call this method and get an inputStream
	 *                 handed back that can be read from. Normally the inputStream
	 *                 ValContainer is null and not used.
	 */
	public void readFromUrl(MongoSession session, String sourceUrl, String nodeId, String mimeHint, int maxFileSize) {
		if (sourceUrl.startsWith("data:")) {
			readFromDataUrl(session, sourceUrl, nodeId, mimeHint, maxFileSize);
		} else {
			readFromStandardUrl(session, sourceUrl, nodeId, mimeHint, maxFileSize);
		}
	}

	public void readFromDataUrl(MongoSession session, String sourceUrl, String nodeId, String mimeHint,
			int maxFileSize) {
		if (maxFileSize == 0) {
			maxFileSize = session.getMaxUploadSize();
		}

		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		String mimeType = Util.getMimeFromDataUrl(sourceUrl);

		if (ImageUtil.isImageMime(mimeType)) {
			InputStream is = new ByteArrayInputStream(sourceUrl.getBytes());
			LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(is, maxFileSize);

			// insert 0L for size now, because we don't know it yet
			attachBinaryFromStream(session, null, nodeId, "data-url", 0L, limitedIs, mimeType, -1, -1, false, false,
					false, false, true, true);
		} else {
			throw new RuntimeEx("Unsupported inline data type.");
		}
	}

	// https://tools.ietf.org/html/rfc2397
	public void readFromStandardUrl(MongoSession session, String sourceUrl, String nodeId, String mimeHint,
			int maxFileSize) {
		if (maxFileSize == 0) {
			maxFileSize = session.getMaxUploadSize();
		}

		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		LimitedInputStreamEx limitedIs = null;

		try {
			URL url = new URL(sourceUrl);
			int timeout = 20;
			RequestConfig config = RequestConfig.custom()//
					.setConnectTimeout(timeout * 1000) //
					.setConnectionRequestTimeout(timeout * 1000) //
					.setSocketTimeout(timeout * 1000).build();

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && mimeHint != null) {
				mimeType = URLConnection.guessContentTypeFromName(mimeHint);
			}

			/*
			 * if this is an image extension, handle it in a special way, mainly to extract
			 * the width, height from it
			 */
			if (ImageUtil.isImageMime(mimeType)) {
				/*
				 * DO NOT DELETE
				 *
				 * Basic version without masquerading as a web browser can cause a 403 error
				 * because some sites don't want just any old stream reading from them. Leave
				 * this note here as a warning and explanation
				 */

				// would restTemplate be better for this ?
				HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
				HttpGet request = new HttpGet(sourceUrl);

				request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
				HttpResponse response = client.execute(request);
				log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
						+ response.getStatusLine().getReasonPhrase());
				InputStream is = response.getEntity().getContent();

				limitedIs = new LimitedInputStreamEx(is, maxFileSize);

				// insert 0L for size now, because we don't know it yet
				attachBinaryFromStream(session, null, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false, false,
						false, true, false, true);
			}
			/*
			 * if not an image extension, we can just stream directly into the database, but
			 * we want to try to get the mime type first, from calling detectImage so that
			 * if we do detect its an image we can handle it as one.
			 */
			else {
				if (!detectAndSaveImage(session, nodeId, sourceUrl, url)) {
					HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
					HttpGet request = new HttpGet(sourceUrl);
					request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
					HttpResponse response = client.execute(request);
					// log.debug("Response Code: " + response.getStatusLine().getStatusCode() + "
					// reason="
					// + response.getStatusLine().getReasonPhrase());
					InputStream is = response.getEntity().getContent();

					limitedIs = new LimitedInputStreamEx(is, maxFileSize);

					// insert 0L for size now, because we don't know it yet
					attachBinaryFromStream(session, null, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false, false,
							false, true, false, true);
				}
			}
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		}
		/* finally block just for extra safety */
		finally {
			// this stream will have been closed by 'attachBinaryFromStream' but we close
			// here too anyway.
			StreamUtil.close(limitedIs);
		}

		api.saveSession(session);
	}

	// FYI: Warning: this way of getting content type doesn't work.
	// String mimeType = URLConnection.guessContentTypeFromStream(inputStream);
	//
	/* returns true if it was detected AND saved as an image */
	private boolean detectAndSaveImage(MongoSession session, String nodeId, String fileName, URL url) {
		ImageInputStream is = null;
		LimitedInputStreamEx is2 = null;
		ImageReader reader = null;
		int maxFileSize = 20 * 1024 * 1024;

		try {
			is = ImageIO.createImageInputStream(url.openStream());
			Iterator<ImageReader> readers = ImageIO.getImageReaders(is);

			if (readers.hasNext()) {
				reader = readers.next();
				String formatName = reader.getFormatName();

				if (formatName != null) {
					formatName = formatName.toLowerCase();
					// log.debug("determined format name of image url: " + formatName);
					reader.setInput(is, true, false);
					BufferedImage bufImg = reader.read(0);
					String mimeType = "image/" + formatName;

					ByteArrayOutputStream os = new ByteArrayOutputStream();
					ImageIO.write(bufImg, formatName, os);
					byte[] bytes = os.toByteArray();
					is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);

					attachBinaryFromStream(session, null, nodeId, fileName, bytes.length, is2, mimeType,
							bufImg.getWidth(null), bufImg.getHeight(null), false, false, false, true, false, true);

					return true;
				}
			}
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		} finally {
			StreamUtil.close(is, is2, reader);
		}

		return false;
	}

	public void writeStream(MongoSession session, SubNode node, LimitedInputStreamEx stream, String fileName,
			String mimeType) {

		api.auth(session, node, PrivilegeType.WRITE);

		DBObject metaData = new BasicDBObject();
		metaData.put("nodeId", node.getId());

		SubNode userNode = api.getUserNodeByUserName(null, null);

		/*
		 * Delete any existing grid data stored under this node, before saving new
		 * attachment
		 */
		deleteBinary(session, node);

		String id = grid.store(stream, fileName, mimeType, metaData).toString();

		long streamCount = stream.getCount();
		// log.debug("upload streamCount=" + streamCount);
		if (!session.isAdmin()) {
			userManagerService.addBytesToUserNodeBytes(streamCount, userNode, 1);
		}

		if (userNode == null) {
			throw new RuntimeEx("User not found.");
		}

		/*
		 * Now save the node also since the property on it needs to point to GridFS id
		 */
		node.setProp(NodeProp.BIN.s(), new SubNodePropVal(id));
		node.setProp(NodeProp.BIN_SIZE.s(), streamCount); 
	}

	public void writeStreamToIpfs(MongoSession session, SubNode node, InputStream stream, String mimeType) {
		api.auth(session, node, PrivilegeType.WRITE);
		ValContainer<Integer> streamSize = new ValContainer<Integer>();
		String ipfsHash = ipfsService.addFromStream(session, stream, mimeType, streamSize);
		node.setProp(NodeProp.IPFS_LINK.s(), new SubNodePropVal(ipfsHash));
		node.setProp(NodeProp.BIN_SIZE.s(), streamSize.getVal());
	}

	/*
	 * todo-0: are there places this is called where it doesn't also delete ALL
	 * binary properties ? via deleteAllBinaryProperties(node);
	 */
	public void deleteBinary(MongoSession session, SubNode node) {
		api.auth(session, node, PrivilegeType.WRITE);
		String id = node.getStringProp("bin");
		if (id == null) {
			return;
		}

		if (!session.isAdmin()) {
			userManagerService.addNodeBytesToUserNodeBytes(node, null, -1);
		}
		
		grid.delete(new Query(Criteria.where("_id").is(id)));
	}

	public InputStream getStream(MongoSession session, SubNode node, boolean auth, boolean ipfs) {
		if (auth) {
			api.auth(session, node, PrivilegeType.READ);
		}

		InputStream is = null;
		if (ipfs) {
			String ipfsHash = node.getStringProp(NodeProp.IPFS_LINK.s());
			String mimeType = node.getStringProp(NodeProp.BIN_MIME.s());
			is = ipfsService.getStream(session, ipfsHash, mimeType);
		} else {
			is = getStreamByNode(node);
		}
		return is;
	}

	public InputStream getStreamByNode(SubNode node) {
		if (node == null)
			return null;
		log.debug("getStreamByNode: " + node.getId().toHexString());

		String id = node.getStringProp("bin");
		if (id == null) {
			return null;
		}

		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(id)));
		// new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (gridFile == null) {
			log.debug("gridfs ID not found");
			return null;
		}

		GridFsResource gridFsResource = new GridFsResource(gridFile,
				gridFsBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			InputStream is = gridFsResource.getInputStream();
			if (is == null) {
				throw new RuntimeEx("Unable to get inputStream");
			}
			return is;
		} catch (Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	public String getStringByNode(MongoSession session, SubNode node) {
		String ret = null;
		if (node != null) {
			api.auth(session, node, PrivilegeType.READ);
			ret = getStringByNodeEx(node);
		}
		return ret;
	}

	/* Gets the content of the grid resource by reading it into a string */
	public String getStringByNodeEx(SubNode node) {
		if (node==null) return null;
		log.debug("getStringByNode: " + node.getId().toHexString());

		String id = node.getStringProp("bin");
		if (id == null) {
			return null;
		}

		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid
				.findOne(new Query(Criteria.where("_id").is(id)));
				//new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (gridFile == null) {
			log.debug("gridfs ID not found");
			return null;
		}

		GridFsResource gridFsResource = new GridFsResource(gridFile,
				gridFsBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			InputStream is = gridFsResource.getInputStream();
			if (is == null) {
				throw new RuntimeEx("Unable to get inputStream");
			}
			String result = IOUtils.toString(is, StandardCharsets.UTF_8.name());
			return result;
		} catch (Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	// public AutoCloseInputStream getAutoClosingStream(MongoSession session, SubNode node, boolean auth,
	// 		boolean ipfs) {
	// 	return new AutoCloseInputStream(new BufferedInputStream(getStream(session, node, auth, ipfs)));
	// }

	/**
	 * This method makes a single pass over all grid items doing all the daily
	 * maintenance on each one as necessary to maintain the system health and
	 * statistics.
	 * 
	 * Scans all the uploaded attachments, and finds any that aren't owned by some
	 * SubNode, and deletes them.
	 * 
	 * I probably can hook into some listener (or just my own delete code) to be
	 * sure to run the 'grid.delete' for the attachments whenever someone deletes a
	 * node also. (todo-1: check into this, can't remember if I did that already)
	 * 
	 * Also keeps totals by each user account, in a hashmap to be written all out at
	 * the end to all the nodes.
	 * 
	 * todo-1: There's another type of background procesing that is potentially
	 * slow/challenging which is to remove all nodes that don't have a parent. How
	 * to do that effeciently will take some thought. These are just ordinary tree
	 * nodes that are orphans
	 */
	public void gridMaintenanceScan() {
		HashMap<ObjectId, UserStats> statsMap = new HashMap<ObjectId, UserStats>();

		adminRunner.run(session -> {

			int delCount = 0;
			GridFSFindIterable files = gridFsBucket.find();

			/* Scan all files in the grid */
			if (files != null) {
				for (GridFSFile file : files) {
					Document meta = file.getMetadata();
					if (meta != null) {
						/* Get which nodeId owns this grid file */
						ObjectId id = (ObjectId) meta.get("nodeId");
						if (id != null) {
							/* Find the node */
							SubNode subNode = api.getNode(session, id);

							/*
							 * If the node doesn't exist then this grid file is an orphan and should go away
							 */
							if (subNode == null) {
								log.debug("Grid Orphan Delete: " + id.toHexString());

								// Query query = new Query(GridFsCriteria.where("_id").is(file.getId());
								Query query = new Query(Criteria.where("_id").is(file.getId()));

								// Note: It's not a bug that we don't call this here:
								// userManagerService.addNodeBytesToUserNodeBytes(node, null, -1);
								// Because all the userstats are updated at the end of this scan.
								grid.delete(query);
								delCount++;
							}
							/*
							 * else update the UserStats by adding the file length to the total for this
							 * user
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

			Iterable<SubNode> accountNodes = api.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null,
					null);

			/*
			 * scan all userAccountNodes, and set a zero amount for those not found (which
			 * will be the correct amount).
			 */
			for (SubNode accountNode : accountNodes) {
				log.debug("Processing Account Node: id=" + accountNode.getId().toHexString());
				UserStats stats = statsMap.get(accountNode.getOwner());
				if (stats == null) {
					stats = new UserStats();
					stats.binUsage = 0L;
					statsMap.put(accountNode.getOwner(), stats);
				}
			}

			log.debug(String.valueOf(delCount) + " orphans found and deleted.");
			userManagerService.writeUserStats(session, statsMap);
		});
	}
}
