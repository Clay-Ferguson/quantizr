package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.awt.image.BufferedImage;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.servlet.http.HttpServletResponse;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSFindIterable;
import com.mongodb.client.gridfs.model.GridFSFile;
import quanta.config.ServiceBase;
import quanta.exception.OutOfSpaceException;
import quanta.exception.base.RuntimeEx;
import quanta.instrument.PerfMon;
import quanta.model.UserStats;
import quanta.model.client.NodeProp;
import quanta.model.client.PrivilegeType;
import quanta.model.ipfs.dag.MerkleLink;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.SubNode;
import quanta.request.DeleteAttachmentRequest;
import quanta.request.UploadFromIPFSRequest;
import quanta.request.UploadFromUrlRequest;
import quanta.response.DeleteAttachmentResponse;
import quanta.response.UploadFromIPFSResponse;
import quanta.response.UploadFromUrlResponse;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.ImageUtil;
import quanta.util.LimitedInputStream;
import quanta.util.LimitedInputStreamEx;
import quanta.util.MimeTypeUtils;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.Val;

/**
 * Service for managing node attachments.
 * 
 * Node attachments are binary attachments that the user can opload onto a node. Each node allows
 * either zero or one attachments. Uploading a new attachment wipes out and replaces the previous
 * attachment. If the attachment is an 'image' type then it gets displayed right on the page.
 * Otherwise a download link is what gets displayed on the node.
 */
@Component
public class AttachmentService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

	@Autowired
	public GridFsTemplate grid;

	@Autowired
	public GridFSBucket gridBucket;

	/*
	 * Upload from User's computer. Standard HTML form-based uploading of a file from user machine
	 */
	public ResponseEntity<?> uploadMultipleFiles(MongoSession ms, String binSuffix, String nodeId, MultipartFile[] uploadFiles,
			boolean explodeZips, boolean toIpfs, boolean addAsChildren) {
		if (no(nodeId)) {
			throw ExUtil.wrapEx("target nodeId not provided");
		}

		try {
			/*
			 * OLD LOGIC: Uploading a single file attaches to the current node, but uploading multiple files
			 * creates each file on it's own subnode (child nodes)
			 */
			// boolean addAsChildren = countFileUploads(uploadFiles) > 1;

			/*
			 * NEW LOGIC: If the node itself currently has an attachment, leave it alone and just upload
			 * UNDERNEATH this current node.
			 */
			SubNode node = read.getNode(ms, nodeId);
			if (no(node)) {
				throw ExUtil.wrapEx("Node not found.");
			}

			auth.ownerAuth(node);

			int maxFileSize = user.getMaxUploadSize(ms);
			int imageCount = 0;

			/*
			 * if uploading multiple files check quota first, to make sure there's space for all files before we
			 * start uploading any of them If there's only one file, the normal flow will catch an out of space
			 * problem, so we don't need to do it in advance in here as we do for multiple file uploads only.
			 * 
			 * Also we only do this check if not admin. Admin can upload unlimited amounts.
			 */
			if (!ms.isAdmin() && uploadFiles.length > 1) {
				SubNode userNode = read.getUserNodeByUserName(null, null);

				// get how many bytes of storage the user currently holds
				Long binTotal = userNode.getInt(NodeProp.BIN_TOTAL);
				if (no(binTotal)) {
					binTotal = 0L;
				}

				// get max amount user is allowed
				Long userQuota = userNode.getInt(NodeProp.BIN_QUOTA);

				for (MultipartFile uploadFile : uploadFiles) {
					binTotal += uploadFile.getSize();

					// check if user went over max and fail the API call if so.
					if (binTotal > userQuota) {
						throw new OutOfSpaceException();
					}
				}
			}

			for (MultipartFile uploadFile : uploadFiles) {
				String fileName = uploadFile.getOriginalFilename();
				String contentType = uploadFile.getContentType();
				if (contentType.startsWith("image/")) {
					imageCount++;
				}

				long size = uploadFile.getSize();
				if (!StringUtils.isEmpty(fileName)) {
					// log.debug("Uploading file: " + fileName + " contentType=" + contentType);

					LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);

					// attaches AND closes the stream.
					attachBinaryFromStream(ms, binSuffix, node, nodeId, fileName, size, limitedIs, contentType, -1, -1,
							addAsChildren, explodeZips, toIpfs, true, false, true, true, null);
				}
			}

			// if we have enough images to lay it out into a square of 3 cols switch to that
			// layout
			if (imageCount >= 9) {
				node.set(NodeProp.LAYOUT, "c3");
			}
			// otherwise, if we have enough images to lay it out into a square of 2 cols
			// switch to that layout.
			else if (imageCount >= 2) {
				node.set(NodeProp.LAYOUT, "c2");
			}

			update.saveSession(ms);
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}

	/*
	 * Gets the binary attachment from a supplied stream and loads it into the repository on the node
	 * specified in 'nodeId'
	 */
	public void attachBinaryFromStream(MongoSession ms, String binSuffix, SubNode node, String nodeId, String fileName, long size,
			LimitedInputStreamEx is, String mimeType, int width, int height, boolean addAsChild, boolean explodeZips,
			boolean toIpfs, boolean calcImageSize, boolean dataUrl, boolean closeStream, boolean storeLocally, String sourceUrl) {

		/*
		 * If caller already has 'node' it can pass node, and avoid looking up node again
		 */
		if (no(node) && ok(nodeId)) {
			node = read.getNode(ms, nodeId);
		}

		/*
		 * Multiple file uploads always attach children for each file uploaded
		 */
		if (addAsChild) {
			auth.ownerAuth(ms, node);
			try {
				SubNode newNode = create.createNode(ms, node, null, null, null, CreateNodeLocation.LAST, null, null, true);
				newNode.setContent(fileName);
				newNode.touch();

				/*
				 * Note: Since the parent node we're creating under might have a "pending" path (unsaved), which is
				 * a path starting withi /r/p/ we have to set this new node to NON pending to change it. It's ok if
				 * the user abandons and never saves because this node will get orpaned if it's parent does so we
				 * don't need to worry about pending path for this one, and just can go with non-pending for the
				 * correct safe behavior
				 */
				mongoUtil.setPendingPath(newNode, false);

				update.save(ms, newNode);
				node = newNode;
			} catch (Exception ex) {
				throw ExUtil.wrapEx(ex);
			}
		} else {
			auth.ownerAuth(node);
		}

		/* mimeType can be passed as null if it's not yet determined */
		if (no(mimeType)) {
			mimeType = getMimeFromFileType(fileName);
		}

		if (explodeZips && "application/zip".equalsIgnoreCase(mimeType)) {
			/*
			 * This is a prototype-scope bean, with state for processing one import at a time
			 */
			ImportZipService importZipStreamService = (ImportZipService) context.getBean(ImportZipService.class);
			importZipStreamService.importFromStream(ms, is, node, false);
		} else {
			saveBinaryStreamToNode(ms, binSuffix, is, mimeType, fileName, size, width, height, node, toIpfs, calcImageSize,
					dataUrl, closeStream, storeLocally, sourceUrl);
		}
	}

	public String getMimeFromFileType(String fileName) {
		String mimeType = null;

		/* mimeType can be passed as null if it's not yet determined */
		if (no(mimeType)) {
			mimeType = URLConnection.guessContentTypeFromName(fileName);
		}

		if (no(mimeType)) {
			String ext = FilenameUtils.getExtension(fileName);
			mimeType = MimeTypeUtils.getMimeType(ext);
		}

		/* fallback to at lest some acceptable mime type */
		if (no(mimeType)) {
			mimeType = "application/octet-stream";
		}

		return mimeType;
	}

	public void saveBinaryStreamToNode(MongoSession ms, String binSuffix, LimitedInputStreamEx inputStream, String mimeType,
			String fileName, long size, int width, int height, SubNode node, boolean toIpfs, boolean calcImageSize,
			boolean dataUrl, boolean closeStream, boolean storeLocally, String sourceUrl) {
		/*
		 * NOTE: Setting this flag to false works just fine, and is more efficient, and will simply do
		 * everything EXCEPT calculate the image size
		 */
		BufferedImage bufImg = null;
		byte[] imageBytes = null;
		InputStream isTemp = null;

		int maxFileSize = user.getMaxUploadSize(ms);

		// Clear out any pre-existing binary properties
		deleteAllBinaryProperties(node, binSuffix);

		// log.debug("Node JSON after BIN props removed: " + XString.prettyPrint(node));
		if (ImageUtil.isImageMime(mimeType)) {

			// default image to be 100% size
			if (no(node.getStr(NodeProp.IMG_SIZE.s() + binSuffix))) {
				node.set(NodeProp.IMG_SIZE.s() + binSuffix, "100%");
			}

			if (calcImageSize) {
				LimitedInputStream is = null;
				try {
					is = new LimitedInputStreamEx(inputStream, maxFileSize);
					imageBytes = IOUtils.toByteArray(is);
					isTemp = new ByteArrayInputStream(imageBytes);
					bufImg = ImageIO.read(isTemp);

					try {
						node.set(NodeProp.IMG_WIDTH.s() + binSuffix, bufImg.getWidth());
						node.set(NodeProp.IMG_HEIGHT.s() + binSuffix, bufImg.getHeight());
					} catch (Exception e) {
						/*
						 * reading files from IPFS caused this exception, and I didn't investigate why yet, because I don't
						 * think it's a bug in my code, but something in IPFS.
						 */
						log.error("Failed to get image length.", e);
					}
				} catch (Exception e) {
					throw ExUtil.wrapEx(e);
				} finally {
					if (closeStream) {
						StreamUtil.close(is, isTemp);
					}
				}
			}
		}

		node.set(NodeProp.BIN_MIME.s() + binSuffix, mimeType);

		if (dataUrl) {
			node.set(NodeProp.BIN_DATA_URL.s() + binSuffix, "t"); // t=true
		}

		SubNode userNode = read.getNode(ms, node.getOwner());

		if (no(imageBytes)) {
			try {
				node.set(NodeProp.BIN_SIZE.s() + binSuffix, size);
				if (toIpfs) {
					writeStreamToIpfs(ms, binSuffix, node, inputStream, mimeType, userNode);
				} else {
					if (storeLocally) {
						if (ok(fileName)) {
							node.set(NodeProp.BIN_FILENAME.s() + binSuffix, fileName);
						}
						writeStream(ms, binSuffix, node, inputStream, fileName, mimeType, userNode);
					} else {
						node.set(NodeProp.BIN_URL.s() + binSuffix, sourceUrl);
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
				node.set(NodeProp.BIN_SIZE.s() + binSuffix, imageBytes.length);

				if (storeLocally) {
					if (ok(fileName)) {
						node.set(NodeProp.BIN_FILENAME.s() + binSuffix, fileName);
					}
					is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
					if (toIpfs) {
						writeStreamToIpfs(ms, binSuffix, node, is, mimeType, userNode);
					} else {
						writeStream(ms, binSuffix, node, is, fileName, mimeType, userNode);
					}
				} else {
					node.set(NodeProp.BIN_URL.s() + binSuffix, sourceUrl);
				}
			} finally {
				StreamUtil.close(is);
			}
		}

		update.save(ms, node);
	}

	/*
	 * Removes the attachment from the node specified in the request.
	 */
	public DeleteAttachmentResponse deleteAttachment(MongoSession ms, DeleteAttachmentRequest req) {
		DeleteAttachmentResponse res = new DeleteAttachmentResponse();
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(node);
		deleteBinary(ms, "", node, null);
		deleteAllBinaryProperties(node, "");
		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}

	/*
	 * Deletes all the binary-related properties from a node
	 */
	public void deleteAllBinaryProperties(SubNode node, String binSuffix) {
		node.delete(NodeProp.IMG_WIDTH.s() + binSuffix);
		node.delete(NodeProp.IMG_HEIGHT.s() + binSuffix);
		node.delete(NodeProp.BIN_MIME.s() + binSuffix);
		node.delete(NodeProp.BIN_FILENAME.s() + binSuffix);
		node.delete(NodeProp.BIN_SIZE.s() + binSuffix);
		node.delete(NodeProp.BIN.s() + binSuffix);
		node.delete(NodeProp.BIN_URL.s() + binSuffix);
		node.delete(NodeProp.BIN_DATA_URL.s() + binSuffix);
		node.delete(NodeProp.IPFS_LINK.s() + binSuffix);
		node.delete(NodeProp.IPFS_REF.s() + binSuffix);
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
	@PerfMon(category = "attach")
	public void getBinary(MongoSession ms, String binSuffix, SubNode node, String nodeId, boolean download,
			HttpServletResponse response) {
		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			ms = ThreadLocals.ensure(ms);

			if (no(node)) {
				node = read.getNode(ms, nodeId, false);
			} else {
				nodeId = node.getIdStr();
			}

			if (no(node)) {
				throw ExUtil.wrapEx("node not found.");
			}

			boolean ipfs = StringUtils.isNotEmpty(node.getStr(NodeProp.IPFS_LINK.s() + binSuffix));

			// Everyone's account node can publish it's attachment and is assumed to be an
			// avatar.
			boolean allowAuth = true;
			if (auth.isAnAccountNode(ms, node)) {
				allowAuth = false;
			}

			if (allowAuth) {
				auth.auth(ms, node, PrivilegeType.READ);
			}

			String mimeTypeProp = node.getStr(NodeProp.BIN_MIME.s() + binSuffix);
			if (no(mimeTypeProp)) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStr(NodeProp.BIN_FILENAME.s() + binSuffix);
			if (no(fileName)) {
				fileName = "filename";
			}

			InputStream is = getStream(ms, binSuffix, node, allowAuth);
			long size = node.getInt(NodeProp.BIN_SIZE.s() + binSuffix);
			// log.debug("Getting Binary for nodeId=" + nodeId + " size=" + size);

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
		} catch (Exception e) {
			log.error(e.getMessage());
		} finally {
			StreamUtil.close(inStream, outStream);
		}
	}

	/**
	 * Downloads a file by name that is expected to be in the Admin Data Folder
	 */
	public void getFile(MongoSession ms, String fileName, String disposition, HttpServletResponse response) {

		if (fileName.contains(".."))
			throw ExUtil.wrapEx("bad request.");

		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			String fullFileName = prop.getAdminDataFolder() + File.separator + fileName;
			File file = new File(fullFileName);
			String checkPath = file.getCanonicalPath();

			if (!checkPath.startsWith(prop.getAdminDataFolder()))
				throw ExUtil.wrapEx("bad request.");

			if (!file.isFile())
				throw ExUtil.wrapEx("file not found.");

			String mimeType = MimeTypeUtils.getMimeType(file);
			if (no(disposition)) {
				disposition = "inline";
			}

			response.setContentType(mimeType);
			response.setContentLength((int) file.length());
			response.setHeader("Content-Disposition", disposition + "; filename=\"" + fileName + "\"");

			// This is max allowed caching time, and is 1 year in seconds
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

	public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(MongoSession ms, String nodeId, String disposition) {
		if (!ms.isAdmin()) {
			throw new RuntimeEx("unauthorized");
		}

		try {
			SubNode node = read.getNode(ms, nodeId, false);
			if (no(node)) {
				throw new RuntimeEx("node not found: " + nodeId);
			}
			String fullFileName = node.getStr(NodeProp.FS_LINK);
			File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeEx("File not found: " + fullFileName);
			}

			String mimeType = MimeTypeUtils.getMimeType(file);
			if (no(disposition)) {
				disposition = "inline";
			}

			/*
			 * I think we could be using the MultipartFileSender here, eventually but not until we decople it
			 * from reading directly from filesystem
			 */
			AutoCloseInputStream acis = new AutoCloseInputStream(new FileInputStream(fullFileName));

			/*
			 * I'm not sure if FileSystemResource is better than StreamingResponseBody, but i do know
			 * StreamingResponseBody does EXACTLY what is needed which is to use a small buffer size and never
			 * hold entire media file all in memory
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

	public Object getStreamResource(MongoSession ms, HttpHeaders headers, String nodeId) {
		BufferedInputStream inStream = null;
		ResponseEntity<ResourceRegion> ret = null;
		try {
			SubNode node = read.getNode(ms, nodeId, false);
			auth.auth(ms, node, PrivilegeType.READ);

			String mimeTypeProp = node.getStr(NodeProp.BIN_MIME.s());
			if (no(mimeTypeProp)) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = node.getStr(NodeProp.BIN_FILENAME.s());
			if (no(fileName)) {
				fileName = "filename";
			}

			// long startTime = System.currentTimeMillis();
			InputStream is = getStream(ms, "", node, false);

			// if (session.isAdmin() && Const.adminDebugStreaming) {
			// long duration = System.currentTimeMillis() - startTime;
			// log.debug("getStream took " + String.valueOf(duration) + "ms");
			// }
			// startTime = System.currentTimeMillis();

			long size = node.getInt(NodeProp.BIN_SIZE);

			if (size == 0) {
				throw new RuntimeEx("Can't stream video without the file size. BIN_SIZE property missing");
			}

			inStream = new BufferedInputStream(is);
			byte[] bytes = IOUtils.toByteArray(inStream);

			ResourceRegion region = resourceRegion(new ByteArrayResource(bytes), headers);
			ret = ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).contentType(MediaType.valueOf(mimeTypeProp)).body(region);

		} catch (Exception e) {
			log.error(e.getMessage());
		}
		return ret;
	}

	private ResourceRegion resourceRegion(Resource resource, HttpHeaders headers) throws IOException {
		/*
		 * todo-2: Will a smaller chunk size be better to get the video playing sooner after first clicked,
		 * or will it do that at the cost of less overall resource effeciency? Need to research
		 */
		long chunkSize = 500000L;
		long contentLength = resource.contentLength();

		HttpRange httpRange = headers.getRange().stream().findFirst().get();
		if (ok(httpRange)) {
			long start = httpRange.getRangeStart(contentLength);
			long end = httpRange.getRangeEnd(contentLength);
			long rangeLength = Long.min(chunkSize, end - start + 1);
			return new ResourceRegion(resource, start, rangeLength);
		} else {
			long rangeLength = Long.min(chunkSize, contentLength);
			return new ResourceRegion(resource, 0, rangeLength);
		}
	}

	/*
	 * Uploads an attachment not from the user's machine but from some arbitrary internet URL they have
	 * provided, that could be pointing to an image or any other kind of content actually.
	 */
	public UploadFromUrlResponse readFromUrl(MongoSession ms, UploadFromUrlRequest req) {
		UploadFromUrlResponse res = new UploadFromUrlResponse();
		readFromUrl(ms, req.getSourceUrl(), req.getNodeId(), null, 0, req.isStoreLocally());
		res.setSuccess(true);
		return res;
	}

	public UploadFromIPFSResponse attachFromIPFS(MongoSession ms, UploadFromIPFSRequest req) {
		UploadFromIPFSResponse res = new UploadFromIPFSResponse();
		if (no(req.getNodeId())) {
			throw new RuntimeException("null nodeId");
		}

		SubNode node = read.getNode(ms, req.getNodeId());
		if (no(node)) {
			throw new RuntimeException("node not found: id=" + req.getNodeId());
		}

		auth.ownerAuth(node);
		node.set(NodeProp.IPFS_LINK, req.getCid().trim());
		String mime = req.getMime().trim().replace(".", "");

		// If an extension was given (not a mime), then use it to make a filename, and
		// generate the mime from it.
		if (!mime.contains("/")) {
			node.set(NodeProp.BIN_FILENAME, "file." + mime);
			mime = MimeTypeUtils.getMimeType(mime);
		}

		node.set(NodeProp.BIN_MIME, mime);
		update.save(ms, node);
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
	 *        Val is null and not used.
	 */
	@PerfMon(category = "attach")
	public void readFromUrl(MongoSession ms, String sourceUrl, String nodeId, String mimeHint, int maxFileSize,
			boolean storeLocally) {
		if (sourceUrl.startsWith("data:")) {
			readFromDataUrl(ms, sourceUrl, nodeId, mimeHint, maxFileSize);
		} else {
			readFromStandardUrl(ms, sourceUrl, nodeId, mimeHint, maxFileSize, storeLocally);
		}
	}

	public void readFromDataUrl(MongoSession ms, String sourceUrl, String nodeId, String mimeHint, int maxFileSize) {
		if (maxFileSize <= 0) {
			maxFileSize = user.getMaxUploadSize(ms);
		}

		ms = ThreadLocals.ensure(ms);
		String mimeType = Util.getMimeFromDataUrl(sourceUrl);

		if (ImageUtil.isImageMime(mimeType)) {
			InputStream is = new ByteArrayInputStream(sourceUrl.getBytes());
			LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(is, maxFileSize);

			// insert 0L for size now, because we don't know it yet
			attachBinaryFromStream(ms, "", null, nodeId, "data-url", 0L, limitedIs, mimeType, -1, -1, false, false, false, false,
					true, true, true, sourceUrl);
		} else {
			throw new RuntimeEx("Unsupported inline data type.");
		}
	}

	// https://tools.ietf.org/html/rfc2397
	public void readFromStandardUrl(MongoSession ms, String sourceUrl, String nodeId, String mimeHint, int maxFileSize,
			boolean storeLocally) {

		if (!storeLocally) {
			SubNode node = read.getNode(ms, nodeId);
			auth.ownerAuth(node);

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && ok(mimeHint)) {
				mimeType = URLConnection.guessContentTypeFromName(mimeHint);
			}

			if (ok(mimeType)) {
				node.set(NodeProp.BIN_MIME.s(), mimeType);
			}
			node.set(NodeProp.BIN_URL.s(), sourceUrl);
			update.saveSession(ms);
			return;
		}

		if (maxFileSize <= 0) {
			maxFileSize = user.getMaxUploadSize(ms);
		}

		ms = ThreadLocals.ensure(ms);
		LimitedInputStreamEx limitedIs = null;

		try {
			URL url = new URL(sourceUrl);
			int timeout = 20;
			RequestConfig config = RequestConfig.custom()//
					.setConnectTimeout(timeout * 1000) //
					.setConnectionRequestTimeout(timeout * 1000) //
					.setSocketTimeout(timeout * 1000).build();

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && ok(mimeHint)) {
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
				HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
				HttpGet request = new HttpGet(sourceUrl);

				request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
				HttpResponse response = client.execute(request);
				log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
						+ response.getStatusLine().getReasonPhrase());
				InputStream is = response.getEntity().getContent();

				limitedIs = new LimitedInputStreamEx(is, maxFileSize);

				// insert 0L for size now, because we don't know it yet
				attachBinaryFromStream(ms, "", null, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false, false, false,
						true, false, true, storeLocally, sourceUrl);
			}
			/*
			 * if not an image extension, we can just stream directly into the database, but we want to try to
			 * get the mime type first, from calling detectImage so that if we do detect its an image we can
			 * handle it as one.
			 */
			else {
				if (!detectAndSaveImage(ms, nodeId, sourceUrl, url, storeLocally)) {
					HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
					HttpGet request = new HttpGet(sourceUrl);
					request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
					HttpResponse response = client.execute(request);
					/*
					 * log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason=" +
					 * response.getStatusLine().getReasonPhrase());
					 */
					InputStream is = response.getEntity().getContent();
					limitedIs = new LimitedInputStreamEx(is, maxFileSize);

					// insert 0L for size now, because we don't know it yet
					attachBinaryFromStream(ms, "", null, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false, false, false, true,
							false, true, storeLocally, sourceUrl);
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

		update.saveSession(ms);
	}

	// FYI: Warning: this way of getting content type doesn't work.
	// String mimeType = URLConnection.guessContentTypeFromStream(inputStream);
	//
	/* returns true if it was detected AND saved as an image */
	private boolean detectAndSaveImage(MongoSession ms, String nodeId, String sourceUrl, URL url, boolean storeLocally) {
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

				if (ok(formatName)) {
					formatName = formatName.toLowerCase();
					// log.debug("determined format name of image url: " + formatName);
					reader.setInput(is, true, false);
					String mimeType = "image/" + formatName;

					BufferedImage bufImg = reader.read(0);
					ByteArrayOutputStream os = new ByteArrayOutputStream();
					ImageIO.write(bufImg, formatName, os);
					byte[] bytes = os.toByteArray();
					is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);

					attachBinaryFromStream(ms, "", null, nodeId, sourceUrl, bytes.length, is2, mimeType, bufImg.getWidth(null),
							bufImg.getHeight(null), false, false, false, true, false, true, storeLocally, sourceUrl);

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

	public void writeStream(MongoSession ms, String binSuffix, SubNode node, LimitedInputStreamEx stream, String fileName,
			String mimeType, SubNode userNode) {

		auth.ownerAuth(node);
		DBObject metaData = new BasicDBObject();
		metaData.put("nodeId" + binSuffix, node.getId());

		if (no(userNode)) {
			userNode = read.getUserNodeByUserName(null, null);
		}

		/*
		 * Delete any existing grid data stored under this node, before saving new attachment
		 */
		deleteBinary(ms, binSuffix, node, userNode);

		// #saveAsPdf work in progress:
		// todo-2: right here if saveAsPdf is true we need to convert the HTML to PDF
		// and write that stream.
		// read stream into html as a string.
		// create new outputstream (in memory) to write to (byte array stream)
		// PdfConverterExtension.exportToPdf(out, html, "", options);
		// get an inputstream that reads what was written, and put it in 'stream',
		// then the rest fo the code remains as is.

		String id = grid.store(stream, fileName, mimeType, metaData).toString();

		long streamCount = stream.getCount();
		// log.debug("upload streamCount=" + streamCount);

		// update the user quota which enforces their total storage limit
		if (!ms.isAdmin()) {
			user.addBytesToUserNodeBytes(ms, streamCount, userNode, 1);
		}

		if (no(userNode)) {
			throw new RuntimeEx("User not found.");
		}

		/*
		 * Now save the node also since the property on it needs to point to GridFS id
		 */
		node.set(NodeProp.BIN.s() + binSuffix, id);
		node.set(NodeProp.BIN_SIZE.s() + binSuffix, streamCount);
	}

	public void writeStreamToIpfs(MongoSession ms, String binSuffix, SubNode node, InputStream stream, String mimeType,
			SubNode userNode) {
		auth.ownerAuth(node);
		Val<Integer> streamSize = new Val<>();

		MerkleLink ret = ipfs.addFromStream(ms, stream, null, mimeType, streamSize, false);
		if (ok(ret)) {
			node.set(NodeProp.IPFS_LINK.s() + binSuffix, ret.getHash());
			node.set(NodeProp.BIN_SIZE.s() + binSuffix, streamSize.getVal());

			/* consume user quota space */
			user.addBytesToUserNodeBytes(ms, streamSize.getVal(), userNode, 1);
		}
	}

	public void deleteBinary(MongoSession ms, String binSuffix, SubNode node, SubNode userNode) {
		if (no(node))
			return;
		auth.ownerAuth(node);
		String id = node.getStr(NodeProp.BIN.s() + binSuffix);
		if (no(id)) {
			return;
		}

		if (!ms.isAdmin()) {
			/*
			 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
			 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
			 * deducted from
			 */
			user.addNodeBytesToUserNodeBytes(ms, node, userNode, -1);
		}

		grid.delete(new Query(Criteria.where("_id").is(id)));
	}

	/*
	 * Gets the binary data attachment stream from the node regardless of wether it's from IPFS_LINK or
	 * BIN
	 */
	public InputStream getStream(MongoSession ms, String binSuffix, SubNode node, boolean doAuth) {
		if (doAuth) {
			auth.auth(ms, node, PrivilegeType.READ);
		}

		InputStream is = null;
		String ipfsHash = node.getStr(NodeProp.IPFS_LINK.s() + binSuffix);
		if (ok(ipfsHash)) {
			/*
			 * todo-2: When the IPFS link happens to be unreachable/invalid (or IFPS disabled?), this can
			 * timeout here by taking too long. This wreaks havoc on the browser thread during some scenarios.
			 * log.debug("Getting IPFS Stream for NodeId " + node.getIdStr() + " IPFS_CID=" + ipfsHash);
			 */
			is = ipfs.getStream(ms, ipfsHash);
		} else {
			is = getStreamByNode(node, binSuffix);
		}
		return is;
	}

	public InputStream getStreamByNode(SubNode node, String binSuffix) {
		if (no(node))
			return null;
		// long startTime = System.currentTimeMillis();
		// log.debug("getStreamByNode: " + node.getIdStr());

		String id = node.getStr(NodeProp.BIN.s() + binSuffix);
		if (no(id)) {
			return null;
		}

		/* why not an import here? */
		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(id)));
		// new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (no(gridFile)) {
			log.debug("gridfs ID not found");
			return null;
		}

		// long duration = System.currentTimeMillis() - startTime;
		// log.debug("grid.foundFile in " + String.valueOf(duration) + "ms");
		// startTime = System.currentTimeMillis();

		GridFsResource gridFsResource = new GridFsResource(gridFile, gridBucket.openDownloadStream(gridFile.getObjectId()));

		// duration = System.currentTimeMillis() - startTime;
		// log.debug("Created GridFsResource in " + String.valueOf(duration) + "ms");
		// startTime = System.currentTimeMillis();

		try {
			InputStream is = gridFsResource.getInputStream();
			if (no(is)) {
				throw new RuntimeEx("Unable to get inputStream");
			}

			// duration = System.currentTimeMillis() - startTime;
			// log.debug("GridFsResource stream obtained in " + String.valueOf(duration) + "ms");

			return is;
		} catch (Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	public String getStringByNode(MongoSession ms, SubNode node) {
		String ret = null;
		if (ok(node)) {
			auth.auth(ms, node, PrivilegeType.READ);
			ret = getStringByNodeEx(node);
		}
		return ret;
	}

	/* Gets the content of the grid resource by reading it into a string */
	public String getStringByNodeEx(SubNode node) {
		if (no(node))
			return null;
		log.debug("getStringByNode: " + node.getIdStr());

		String id = node.getStr("bin");
		if (no(id)) {
			return null;
		}

		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(id)));
		// new Query(Criteria.where("metadata.nodeId").is(nodeId)));
		if (no(gridFile)) {
			log.debug("gridfs ID not found");
			return null;
		}

		GridFsResource gridFsResource = new GridFsResource(gridFile, gridBucket.openDownloadStream(gridFile.getObjectId()));
		try {
			InputStream is = gridFsResource.getInputStream();
			if (no(is)) {
				throw new RuntimeEx("Unable to get inputStream");
			}
			String result = IOUtils.toString(is, StandardCharsets.UTF_8.name());
			return result;
		} catch (Exception e) {
			throw new RuntimeEx("unable to readStream", e);
		}
	}

	public int getGridItemCount() {
		return arun.run(ms -> {
			int count = 0;
			GridFSFindIterable files = gridBucket.find();

			/* Scan all files in the grid */
			if (ok(files)) {
				/*
				 * I am needing this quick and didn't find another way to do this other than brute force scan. Maybe
				 * they are using a linked list so that there genuinely is no faster way ?
				 */
				for (GridFSFile file : files) {
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
		arun.run(ms -> {
			int delCount = 0;
			GridFSFindIterable files = gridBucket.find();

			/* Scan all files in the grid */
			if (ok(files)) {
				for (GridFSFile file : files) {
					Document meta = file.getMetadata();
					if (ok(meta)) {
						/* Get which nodeId owns this grid file */
						ObjectId id = (ObjectId) meta.get("nodeId");

						/*
						 * If the grid file is not based off 'nodeId' then we still need to check if it's a Header image
						 * (special case)
						 */
						if (no(id)) {
							/*
							 * todo-2: currently we only have "Header" as a (binSuffix), and it may stay that way forever, as
							 * the only violation of the one-binary-per-node rule.
							 * 
							 * Actually we need a cleaner solution than having 'suffixed' versions of all binary properties.
							 * That was an ugly hack.
							 */
							id = (ObjectId) meta.get("nodeIdHeader");
						}

						if (ok(id)) {
							/* Find the node */
							SubNode subNode = read.getNode(ms, id);

							/*
							 * If the node doesn't exist then this grid file is an orphan and should go away
							 */
							if (no(subNode)) {
								log.debug("Grid Orphan Delete: " + id.toHexString());

								// Query query = new Query(GridFsCriteria.where("_id").is(file.getId());
								Query q = new Query(Criteria.where("_id").is(file.getId()));

								// Note: It's not a bug that we don't call this here:
								// usrMgr.addNodeBytesToUserNodeBytes(session, node, null, -1);
								// Because all the userstats are updated at the end of this scan.
								grid.delete(q);
								delCount++;
							}
							/*
							 * else update the UserStats by adding the file length to the total for this user
							 */
							else {
								UserStats stats = statsMap.get(subNode.getOwner());
								if (no(stats)) {
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

			Iterable<SubNode> accountNodes =
					read.getChildren(ms, MongoUtil.allUsersRootNode.getId(), null, null, 0, null, null);

			/*
			 * scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
			 * amount).
			 */
			for (SubNode accountNode : accountNodes) {
				log.debug("Processing Account Node: id=" + accountNode.getIdStr());
				UserStats stats = statsMap.get(accountNode.getOwner());
				if (no(stats)) {
					stats = new UserStats();
					stats.binUsage = 0L;
					statsMap.put(accountNode.getOwner(), stats);
				}
			}

			log.debug(String.valueOf(delCount) + " grid orphans deleted.");
			return null;
		});
	}
}
