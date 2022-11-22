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
import java.util.List;
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
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
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
import quanta.util.Val;
import quanta.util.XString;

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
	public ResponseEntity<?> uploadMultipleFiles(MongoSession ms, String attName, String nodeId, MultipartFile[] uploadFiles,
			boolean explodeZips, boolean toIpfs, boolean addAsChildren) {
		if (toIpfs) {
			checkIpfs();
		}
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
			 * UNDERNEATH this current node. Pass allowAuth=false here becasue below we check the ownerAuth
			 * which will be even more strict.
			 */
			SubNode node = read.getNode(ms, nodeId, false, null);
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
					attachBinaryFromStream(ms, false, attName, node, nodeId, fileName, size, limitedIs, contentType, -1, -1,
							addAsChildren, explodeZips, toIpfs, true, true, true, null);
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
	public void attachBinaryFromStream(MongoSession ms, boolean importMode, String attName, SubNode node, String nodeId,
			String fileName, long size, LimitedInputStreamEx is, String mimeType, int width, int height, boolean addAsChild,
			boolean explodeZips, boolean toIpfs, boolean calcImageSize, boolean closeStream, boolean storeLocally,
			String sourceUrl) {

		/*
		 * If caller already has 'node' it can pass node, and avoid looking up node again
		 */
		if (no(node) && ok(nodeId)) {
			node = read.getNode(ms, nodeId);
		}
		auth.ownerAuth(ms, node);

		/*
		 * Multiple file uploads always attach children for each file uploaded (correction: addAsChild is
		 * currently never sending true ever from client becasue for now we always add multiple files to
		 * SAME node)
		 */
		if (addAsChild) {
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
			saveBinaryStreamToNode(ms, importMode, attName, is, mimeType, fileName, size, width, height, node, toIpfs,
					calcImageSize, closeStream, storeLocally, sourceUrl);
		}
	}

	public void pinLocalIpfsAttachments(SubNode node) {
		if (no(node) || no(node.getAttachments()))
			return;

		node.getAttachments().forEach((String key, Attachment att) -> {
			/*
			 * If we have an IPFS attachment and there's no IPFS_REF property that means it should be pinned.
			 * (IPFS_REF means 'referenced' and external to our server).
			 */
			if (ok(att.getIpfsLink())) {
				// if there's no 'ref' property this is not a foreign reference, which means we
				// DO pin this.
				if (no(att.getIpfsRef())) {
					arun.run(sess -> {
						// don't pass the actual node into here, because it runs in a separate thread and would be
						// a concurrency problem.
						ipfsPin.ipfsAsyncPinNode(sess, node.getId());
						return null;
					});
				}
				// otherwise we don't pin it.
				else {
					/*
					 * Don't do this removePin. Leave this comment here as a warning of what NOT to do! We can't simply
					 * remove the CID from our IPFS database because some node stopped using it, because there may be
					 * many other users/nodes potentially using it, so we let the releaseOrphanIPFSPins be our only way
					 * pins ever get removed, because that method does a safe and correct delete of all pins that are
					 * truly no longer in use by anyone
					 */
					// ipfs.removePin(ipfsLink);
				}
			}
		});
	}

	public void fixAllAttachmentMimes(SubNode node) {
		if (no(node) || no(node.getAttachments()))
			return;

		node.getAttachments().forEach((String key, Attachment att) -> {
			String mimeType = att.getMime();
			// ensure we have the best mimeType we can if not set in the data.
			if (StringUtils.isEmpty(mimeType)) {
				String binUrl = att.getUrl();
				if (!StringUtils.isEmpty(binUrl)) {
					mimeType = getMimeTypeFromUrl(binUrl);

					if (!StringUtils.isEmpty(mimeType)) {
						att.setMime(mimeType);
					}
				}
			}
		});
	}

	public String getMimeTypeFromUrl(String url) {
		String mimeType = null;

		// try to get mime from name first.
		mimeType = URLConnection.guessContentTypeFromName(url);

		// if didn't get mime from name, try reading the actual url
		if (StringUtils.isEmpty(mimeType)) {
			int timeout = 60; // seconds
			try {
				URLConnection conn = new URL(url).openConnection();
				conn.setConnectTimeout(timeout * 1000);
				conn.setReadTimeout(timeout * 1000);
				mimeType = conn.getContentType();
			} catch (Exception e) {
			}
		}
		return mimeType;
	}

	// Another way is this (according to baeldung site)
	// Path path = new File("product.png").toPath();
	// String mimeType = Files.probeContentType(path);
	//
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

	public void saveBinaryStreamToNode(MongoSession ms, boolean importMode, String attName, LimitedInputStreamEx inputStream,
			String mimeType, String fileName, long size, int width, int height, SubNode node, boolean toIpfs,
			boolean calcImageSize, boolean closeStream, boolean storeLocally, String sourceUrl) {
		/*
		 * NOTE: Setting this flag to false works just fine, and is more efficient, and will simply do
		 * everything EXCEPT calculate the image size
		 */
		BufferedImage bufImg = null;
		byte[] imageBytes = null;
		InputStream isTemp = null;
		int maxFileSize = user.getMaxUploadSize(ms);
		Attachment att = null;

		if (importMode) {
			att = node.getAttachment(attName, false, false);
			fileName = att.getFileName();
		} else {
			// if no attName given we try to use "primary", but if primary exists, we find a different name
			if (StringUtils.isEmpty(attName) && ok(node.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false))) {
				attName = getNextAttachmentKey(node);
			}

			int maxAttOrdinal = getMaxAttachmentOrdinal(node);
			att = node.getAttachment(attName, true, true);
			att.setOrdinal(maxAttOrdinal + 1);
		}

		if (ImageUtil.isImageMime(mimeType)) {

			// default image to be 100% size
			att.setCssSize("100%");

			if (calcImageSize) {
				LimitedInputStream is = null;
				try {
					is = new LimitedInputStreamEx(inputStream, maxFileSize);
					imageBytes = IOUtils.toByteArray(is);
					isTemp = new ByteArrayInputStream(imageBytes);
					bufImg = ImageIO.read(isTemp);

					try {
						att.setWidth(bufImg.getWidth());
						att.setHeight(bufImg.getHeight());
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

		att.setMime(mimeType);
		SubNode userNode = read.getNode(ms, node.getOwner());

		if (no(imageBytes)) {
			try {
				att.setSize(size);

				if (toIpfs) {
					writeStreamToIpfs(ms, attName, node, inputStream, mimeType, userNode);
				} else {
					if (storeLocally) {
						if (ok(fileName)) {
							att.setFileName(fileName);
						}
						writeStream(ms, importMode, attName, node, inputStream, fileName, mimeType, userNode);
					} else {
						att.setUrl(sourceUrl);
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
				att.setSize((long) imageBytes.length);

				if (storeLocally) {
					if (ok(fileName)) {
						att.setFileName(fileName);
					}
					is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
					if (toIpfs) {
						writeStreamToIpfs(ms, attName, node, is, mimeType, userNode);
					} else {
						writeStream(ms, importMode, attName, node, is, fileName, mimeType, userNode);
					}
				} else {
					att.setUrl(sourceUrl);
				}

			} finally {
				StreamUtil.close(is);
			}
		}

		log.debug("Node to save: " + XString.prettyPrint(node));
		update.save(ms, node);
	}

	public String getNextAttachmentKey(SubNode node) {
		int imgIdx = 1;
		while (ok(node.getAttachment("img" + String.valueOf(imgIdx), false, false))) {
			imgIdx++;
		}
		return "img" + String.valueOf(imgIdx);
	}

	/* appends all the attachments from sourceNode onto targetNode, leaving targetNode as is */
	public void mergeAttachments(SubNode sourceNode, SubNode targetNode) {
		if (no(sourceNode) || no(targetNode))
			return;

		List<Attachment> atts = sourceNode.getOrderedAttachments();
		if (ok(atts)) {
			for (Attachment att : atts) {
				String newKey = getNextAttachmentKey(targetNode);
				att.setKey(newKey);
				targetNode.addAttachment(att);
			}
		}
	}

	public int getMaxAttachmentOrdinal(SubNode node) {
		int max = -1;
		if (ok(node.getAttachments())) {
			for (String key : node.getAttachments().keySet()) {
				Attachment att = node.getAttachments().get(key);
				if (att.getOrdinal() > max) {
					max = att.getOrdinal();
				}
			}
		}
		return max;
	}

	/*
	 * Removes the attachment from the node specified in the request.
	 */
	public DeleteAttachmentResponse deleteAttachment(MongoSession ms, DeleteAttachmentRequest req) {
		DeleteAttachmentResponse res = new DeleteAttachmentResponse();
		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuth(node);

		final List<String> attKeys = XString.tokenize(req.getAttName(), ",", true);
		if (ok(attKeys)) {
			for (String attKey : attKeys) {
				deleteBinary(ms, attKey, node, null, false);
			}
		}
		res.setSuccess(true);
		return res;
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
	public void getBinary(MongoSession ms, String attName, SubNode node, String nodeId, String binId, boolean download,
			HttpServletResponse response) {
		BufferedInputStream inStream = null;
		BufferedOutputStream outStream = null;

		try {
			ms = ThreadLocals.ensure(ms);

			if (no(node)) {
				node = read.getNode(ms, nodeId, false, null);
			} else {
				nodeId = node.getIdStr();
			}

			if (no(node)) {
				throw ExUtil.wrapEx("node not found.");
			}

			Attachment att = null;
			// todo-2: put this in a method (finding attachment by binId)
			if (ok(node.getAttachments())) {
				for (String key : node.getAttachments().keySet()) {
					Attachment curAtt = node.getAttachments().get(key);
					if (ok(curAtt.getBin()) && curAtt.getBin().equals(binId)) {
						att = curAtt;
						attName = key;
						break;
					}
				}
			}

			if (no(att)) {
				att = node.getAttachment(attName, false, false);
				if (no(att)) {
					throw ExUtil.wrapEx("attachment info not found.");
				}
			}

			boolean ipfs = StringUtils.isNotEmpty(att.getIpfsLink());

			// Everyone's account node can publish it's attachment and is assumed to be an
			// avatar.
			boolean allowAuth = true;
			if (auth.isAnAccountNode(ms, node)) {
				allowAuth = false;
			}

			if (allowAuth) {
				auth.auth(ms, node, PrivilegeType.READ);
			}

			String mimeTypeProp = att.getMime();
			if (no(mimeTypeProp)) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = att.getFileName();
			if (no(fileName)) {
				fileName = "filename";
			}

			InputStream is = getStream(ms, attName, node, allowAuth);
			if (no(is)) {
				throw new RuntimeException("Image not found.");
			}
			long size = att.getSize();
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
			SubNode node = read.getNode(ms, nodeId, false, null);
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
			SubNode node = read.getNode(ms, nodeId, false, null);
			Attachment att = node.getFirstAttachment();
			if (no(att))
				throw ExUtil.wrapEx("no attachment info found");

			auth.auth(ms, node, PrivilegeType.READ);

			String mimeTypeProp = att.getMime();
			if (no(mimeTypeProp)) {
				throw ExUtil.wrapEx("unable to find mimeType property");
			}

			String fileName = att.getFileName();
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

			long size = att.getSize();

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
		readFromUrl(ms, req.getSourceUrl(), null, req.getNodeId(), null, null, 0, req.isStoreLocally());
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

		// todo-1: make this handle multiple attachments, and all calls to it
		Attachment att = node.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), true, true);

		auth.ownerAuth(node);
		att.setIpfsLink(req.getCid().trim());
		String mime = req.getMime().trim().replace(".", "");

		// If an extension was given (not a mime), then use it to make a filename, and
		// generate the mime from it.
		if (!mime.contains("/")) {
			att.setFileName("file." + mime);
			mime = MimeTypeUtils.getMimeType(mime);
		}

		att.setMime(mime);
		update.save(ms, node);
		res.setSuccess(true);
		return res;
	}

	/**
	 * @param mimeHint This is an additional string invented because IPFS urls don't contain the file
	 *        extension always and in that case we need to get it from the IPFS filename itself and
	 *        that's what the hint is in that case. Normally however mimeHint is null
	 * 
	 *        'inputStream' is a retrofit to this function for when we want to just call this method and
	 *        get an inputStream handed back that can be read from. Normally the inputStream Val is null
	 *        and not used.
	 * 
	 *        NOTE: If 'node' is already available caller should pass it, or else can pass nodeId.
	 */
	@PerfMon(category = "attach")
	public void readFromUrl(MongoSession ms, String sourceUrl, SubNode node, String nodeId, String mimeHint, String mimeType,
			int maxFileSize, boolean storeLocally) {

		if (no(mimeType)) {
			mimeType = getMimeTypeFromUrl(sourceUrl);
			if (StringUtils.isEmpty(mimeType) && ok(mimeHint)) {
				mimeType = URLConnection.guessContentTypeFromName(mimeHint);
			}
			// log.debug("ended up with mimeType: " + mimeType);
		}

		if (no(node)) {
			node = read.getNode(ms, nodeId);
			// only need to auth if we looked up the node.
		}
		auth.ownerAuth(node);
		String attKey = getNextAttachmentKey(node);

		if (!storeLocally) {
			Attachment att = node.getAttachment(attKey, true, true);
			if (ok(mimeType)) {
				att.setMime(mimeType);
			}
			att.setUrl(sourceUrl);
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
				attachBinaryFromStream(ms, false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false, false,
						false, true, true, storeLocally, sourceUrl);
			}
			/*
			 * if not an image extension, we can just stream directly into the database, but we want to try to
			 * get the mime type first, from calling detectImage so that if we do detect its an image we can
			 * handle it as one.
			 */
			else {
				if (!detectAndSaveImage(ms, nodeId, attKey, sourceUrl, url, storeLocally)) {
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
					attachBinaryFromStream(ms, false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false, false,
							false, true, true, storeLocally, sourceUrl);
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
	}

	// FYI: Warning: this way of getting content type doesn't work.
	// String mimeType = URLConnection.guessContentTypeFromStream(inputStream);
	//
	/* returns true if it was detected AND saved as an image */
	private boolean detectAndSaveImage(MongoSession ms, String nodeId, String attKey, String sourceUrl, URL url,
			boolean storeLocally) {
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

					attachBinaryFromStream(ms, false, attKey, null, nodeId, sourceUrl, bytes.length, is2, mimeType,
							bufImg.getWidth(null), bufImg.getHeight(null), false, false, false, true, true, storeLocally,
							sourceUrl);

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

	public void writeStream(MongoSession ms, boolean importMode, String attName, SubNode node, LimitedInputStreamEx stream,
			String fileName, String mimeType, SubNode userNode) {

		// don't create attachment here, there shuold already be one, but we pass create=true anyway
		Attachment att = node.getAttachment(attName, !importMode, false);

		auth.ownerAuth(node);
		DBObject metaData = new BasicDBObject();
		metaData.put("nodeId", node.getId());

		if (no(userNode)) {
			userNode = read.getUserNodeByUserName(null, null);
		}

		// if we're importing we should leave any binary alone
		if (!importMode) {
			/*
			 * Delete any existing grid data stored under this node, before saving new attachment
			 */
			deleteBinary(ms, attName, node, userNode, true);
		}

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
			user.addBytesToUserNodeBytes(ms, streamCount, userNode);
		}

		if (no(userNode)) {
			throw new RuntimeEx("User not found.");
		}

		/*
		 * Now save the node also since the property on it needs to point to GridFS id
		 */
		att.setBin(id);
		att.setSize(streamCount);

		if (importMode) {
			log.debug("Setting attachment id to " + id + " on subNode " + att.getOwnerNode().getIdStr());
		}
	}

	public void writeStreamToIpfs(MongoSession ms, String attName, SubNode node, InputStream stream, String mimeType,
			SubNode userNode) {
		auth.ownerAuth(node);
		Attachment att = node.getAttachment(attName, true, false);
		Val<Integer> streamSize = new Val<>();

		MerkleLink ret = ipfs.addFromStream(ms, stream, null, mimeType, streamSize, false);
		if (ok(ret)) {
			att.setIpfsLink(ret.getHash());
			att.setSize((long) streamSize.getVal());

			/* consume user quota space */
			user.addBytesToUserNodeBytes(ms, streamSize.getVal(), userNode);
		}
	}

	/*
	 * Assumes owner 'ms' has already been auth-checked for owning this node. If 'gridOnly' is true that
	 * means we should only delete from the GRID DB, and not touch any of the properties on the node
	 * itself
	 */
	public void deleteBinary(MongoSession ms, String attName, SubNode node, SubNode userNode, boolean gridOnly) {
		if (no(node))
			return;

		HashMap<String, Attachment> attachments = node.getAttachments();
		if (no(attachments))
			return;
		Attachment att = attachments.get(attName);
		if (no(att))
			return;

		if (!gridOnly) {
			attachments.remove(attName);
			node.setAttachments(attachments);
		}

		if (!ms.isAdmin()) {
			/*
			 * NOTE: There is no equivalent to this on the IPFS code path for deleting ipfs becuase since we
			 * don't do reference counting we let the garbage collecion cleanup be the only way user quotas are
			 * deducted from
			 */
			long totalBytes = user.getTotalAttachmentBytes(ms, node);
			user.addBytesToUserNodeBytes(ms, -totalBytes, userNode);
		}

		grid.delete(new Query(Criteria.where("_id").is(att.getBin())));
	}

	/*
	 * Gets the binary data attachment stream from the node regardless of wether it's from IPFS_LINK or
	 * BIN.
	 * 
	 * tood-0: search all calls to this and verify attName is correct.
	 */
	public InputStream getStream(MongoSession ms, String attName, SubNode node, boolean doAuth) {
		if (doAuth) {
			auth.auth(ms, node, PrivilegeType.READ);
		}

		Attachment att = node.getAttachment(attName, false, false);
		if (no(att))
			return null;

		InputStream is = null;
		String ipfsHash = att.getIpfsLink();
		if (ok(ipfsHash)) {
			/*
			 * todo-2: When the IPFS link happens to be unreachable/invalid (or IFPS disabled?), this can
			 * timeout here by taking too long. This wreaks havoc on the browser thread during some scenarios.
			 * log.debug("Getting IPFS Stream for NodeId " + node.getIdStr() + " IPFS_CID=" + ipfsHash);
			 */
			is = ipfs.getStream(ms, ipfsHash);
		} else {
			is = getStreamByNode(node, attName);
		}
		return is;
	}

	public InputStream getStreamByNode(SubNode node, String attName) {
		if (no(node))
			return null;
		// long startTime = System.currentTimeMillis();
		// log.debug("getStreamByNode: " + node.getIdStr());

		Attachment att = node.getAttachment(attName, false, false);
		if (no(att) || no(att.getBin()))
			return null;

		/* why not an import here? */
		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(att.getBin())));
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

		Attachment att = node.getFirstAttachment();
		if (no(att) || no(att.getBin()))
			return null;

		com.mongodb.client.gridfs.model.GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(att.getBin())));
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
		return arun.run(as -> {
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
		arun.run(as -> {
			int delCount = 0;
			// todo-1: do we need to replace this with a 'stream' of some kind to ensure we won't run out of
			// memory?
			GridFSFindIterable files = gridBucket.find();

			/* Scan all files in the grid */
			if (ok(files)) {
				for (GridFSFile file : files) {
					Document meta = file.getMetadata();
					if (ok(meta)) {
						/* Get which nodeId owns this grid file */
						ObjectId id = (ObjectId) meta.get("nodeId");

						// checking for the obsolete key (we can remove this some day, or clean the db of these)
						if (no(id)) {
							id = (ObjectId) meta.get("nodeIdh");
						}

						// checking for the obsolete key (we can remove this some day, or clean the db of these)
						if (no(id)) {
							id = (ObjectId) meta.get("nodeIdHeader");
						}

						if (ok(id)) {
							/* Find the node */
							SubNode subNode = read.getNode(as, id);

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

			Iterable<SubNode> accountNodes = read.getChildren(as, MongoUtil.allUsersRootNode, null, null, 0, null);

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
