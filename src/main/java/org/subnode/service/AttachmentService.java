package org.subnode.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.Iterator;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SpringContextUtil;
import org.subnode.image.ImageUtil;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.request.DeleteAttachmentRequest;
import org.subnode.request.UploadFromUrlRequest;
import org.subnode.response.DeleteAttachmentResponse;
import org.subnode.response.UploadFromUrlResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStream;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.MimeTypeUtils;
import org.subnode.util.MultipartFileSender;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;

import org.apache.commons.io.IOUtils;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

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
	private AllSubNodeTypes TYPES;

	/*
	 * Upload from User's computer. Standard HTML form-based uploading of a file
	 * from user machine
	 */
	public ResponseEntity<?> uploadMultipleFiles(MongoSession session, String nodeId, MultipartFile[] uploadFiles,
			boolean explodeZips) {
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
				throw ExUtil.newEx("Node not found.");
			}

			api.auth(session, node, PrivilegeType.WRITE);

			boolean addAsChildren = uploadFiles.length > 1;
			int maxFileSize = 20 * 1024 * 1024;

			for (MultipartFile uploadFile : uploadFiles) {
				String fileName = uploadFile.getOriginalFilename();
				long size = uploadFile.getSize();
				if (!StringUtils.isEmpty(fileName)) {
					log.debug("Uploading file: " + fileName);

					LimitedInputStreamEx limitedIs = null;
					try {
						limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);
						attachBinaryFromStream(session, node, nodeId, fileName, size, limitedIs, null, -1, -1,
								addAsChildren, explodeZips);
					} finally {
						StreamUtil.close(limitedIs);
					}
				}
			}
			api.saveSession(session);
		} catch (Exception e) {
			log.error(e.getMessage());
			return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}

	//
	// private int countFileUploads(MultipartFile[] uploadFiles) {
	// int count = 0;
	// for (MultipartFile uploadFile : uploadFiles) {
	// String fileName = uploadFile.getOriginalFilename();
	// if (!StringUtils.isEmpty(fileName)) {
	// count++;
	// }
	// }
	// return count;
	// }
	//

	/*
	 * Gets the binary attachment from a supplied stream and loads it into the
	 * repository on the node specified in 'nodeId'
	 */
	public void attachBinaryFromStream(MongoSession session, SubNode node, String nodeId, String fileName, long size,
			LimitedInputStreamEx is, String mimeType, int width, int height, boolean addAsChild, boolean explodeZips) {

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
				throw ExUtil.newEx(ex);
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
			importZipStreamService.inputZipFileFromStream(session, is, node, false);
		} else {
			saveBinaryStreamToNode(session, is, mimeType, fileName, size, width, height, node);
		}
	}

	public void saveBinaryStreamToNode(MongoSession session, LimitedInputStreamEx inputStream, String mimeType,
			String fileName, long size, int width, int height, SubNode node) {

		Long version = node.getIntProp(NodeProp.BIN_VER.toString());
		if (version == null) {
			version = 0L;
		}

		/*
		 * NOTE: Setting this flag to false works just fine, and is more efficient, and
		 * will simply do everything EXCEPT calculate the image size
		 */
		boolean calcImageSizes = true;

		BufferedImage bufImg = null;
		byte[] imageBytes = null;
		InputStream isTemp = null;
		int maxFileSize = 20 * 1024 * 1024;

		if (calcImageSizes && ImageUtil.isImageMime(mimeType)) {
			LimitedInputStream is = null;
			try {
				is = new LimitedInputStreamEx(inputStream, maxFileSize);
				imageBytes = IOUtils.toByteArray(is);
				isTemp = new ByteArrayInputStream(imageBytes);
				bufImg = ImageIO.read(isTemp);

				try {
					node.setProp(NodeProp.IMG_WIDTH.toString(), bufImg.getWidth());
					node.setProp(NodeProp.IMG_HEIGHT.toString(), bufImg.getHeight());
				} catch (Exception e) {
					/*
					 * reading files from IPFS caused this exception, and I didn't investigate why
					 * yet, because I don't think it's a bug in my code, but something in IPFS.
					 */
					log.error("Failed to get image length.", e);
				}
			} catch (Exception e) {
				throw new RuntimeException(e);
			} finally {
				StreamUtil.close(is, isTemp);
			}
		}

		node.setProp(NodeProp.BIN_MIME.toString(), mimeType);
		if (fileName != null) {
			node.setProp(NodeProp.BIN_FILENAME.toString(), fileName);
		}

		log.debug("Uploading new BIN_VER: " + String.valueOf(version + 1));
		node.setProp(NodeProp.BIN_VER.toString(), version + 1);

		if (imageBytes == null) {
			node.setProp(NodeProp.BIN_SIZE.toString(), size);
			api.writeStream(session, node, inputStream, null, mimeType, null);
		} else {
			LimitedInputStream is = null;
			try {
				node.setProp(NodeProp.BIN_SIZE.toString(), imageBytes.length);
				is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
				api.writeStream(session, node, is, null, mimeType, null);
			} finally {
				StreamUtil.close(is);
			}
		}

		api.save(session, node);
	}

	/*
	 * Removes the attachment from the node specified in the request.
	 */
	public void deleteAttachment(MongoSession session, DeleteAttachmentRequest req, DeleteAttachmentResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		api.deleteBinary(session, node, null);
		deleteAllBinaryProperties(node);
		api.saveSession(session);
		res.setSuccess(true);
	}

	/*
	 * Deletes all the binary-related properties from a node
	 */
	private void deleteAllBinaryProperties(SubNode node) {
		node.deleteProp(NodeProp.IMG_WIDTH.toString());
		node.deleteProp(NodeProp.IMG_HEIGHT.toString());
		node.deleteProp(NodeProp.BIN_MIME.toString());
		node.deleteProp(NodeProp.BIN_FILENAME.toString());
		node.deleteProp(NodeProp.BIN_SIZE.toString());

		// NO! Do not delete binary version property. Browsers are allowed to cache
		// based on the URL of this node and this version.
		// What can happen if you ever delete BIN_VER is that it will reset the version
		// back to '1', and then when the user's browser
		// finds the URL with 'ver=1' it will display the OLD IMAGE (assuming it's an
		// image attachment). The way this would happen is a user uploads an image, then
		// deletes it
		// and then uploads another image. So really the places in the code where we
		// check for BIN_VER
		// to see if there's an attachment or not should be changed to look for BIN_MIME
		// instead.
		// node.deleteProp(NodeProp.BIN_VER);
	}

	/*
	 * Returns data for an attachment (Could be an image request, or any type of
	 * request for binary data from a node). This is the method that services all
	 * calls from the browser to get the data for the attachment to download/display
	 * the attachment.
	 */
	public ResponseEntity<StreamingResponseBody> getBinary(MongoSession session, String nodeId) {
		try {
			if (session == null) {
				session = ThreadLocals.getMongoSession();
			}
			SubNode node = api.getNode(session, nodeId);

			String mimeTypeProp = node.getStringProp(NodeProp.BIN_MIME.toString());
			if (mimeTypeProp == null) {
				throw ExUtil.newEx("unable to find mimeType property");
			}
			// log.debug("Retrieving mime: " +
			// mimeTypeProp.getValue().getString());

			// Property dataProp = node.getProperty(JcrProp.BIN_DATA);
			// if (dataProp == null) {
			// throw ExUtil.newEx("unable to find data property");
			// }
			//
			// Binary binary = dataProp.getBinary();
			// log.debug("Retrieving binary bytes: " + binary.getSize());

			String fileName = node.getStringProp(NodeProp.BIN_FILENAME.toString());
			if (fileName == null) {
				fileName = "filename";
			}

			AutoCloseInputStream acis = api.getAutoClosingStream(session, node, null);
			StreamingResponseBody stream = (os) -> {
				IOUtils.copy(acis, os);
				os.flush();
			};
			long size = node.getIntProp(NodeProp.BIN_SIZE.toString());

			return ResponseEntity.ok()//
					.contentLength(size)//
					/*
					 * To make, for example an image type of resource DISPLAY in the browser (rather
					 * than a downloaded file), you'd need this to be omitted (or 'inline')
					 */
					.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")//
					.contentType(MediaType.parseMediaType(mimeTypeProp))//
					.body(stream);
		} catch (Exception e) {
			log.error(e.getMessage());
			return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
		}
	}

	/*
	 * formatted==true indicates we will be sending back actually an HTML response
	 * that does the bare minimum to load the markdown into the google marked
	 * component and render it.
	 * 
	 * Downloads a file by name that is expected to be in the Admin Data Folder
	 */
	public ResponseEntity<StreamingResponseBody> getFile(MongoSession session, String fileName, String disposition,
			boolean formatted) {
		if (fileName.contains(".."))
			throw ExUtil.newEx("bad request.");

		try {
			String fullFileName = appProp.getAdminDataFolder() + File.separator + fileName;
			File file = new File(fullFileName);
			String checkPath = file.getCanonicalPath();
			/*
			 * todo-1: for better security make a REAL '/file/' folder under admin folder
			 * and assert that the file is in there directly
			 */
			if (!checkPath.startsWith(appProp.getAdminDataFolder()))
				throw ExUtil.newEx("bad request.");

			if (!file.isFile())
				throw ExUtil.newEx("file not found.");

			String mimeType = mimeTypeUtils.getMimeType(file);
			if (disposition == null) {
				disposition = "inline";
			}

			// I think we could be using the MultipartFileSender here, eventually but not
			// until we decople it from reading directly from filesystem
			AutoCloseInputStream acis = new AutoCloseInputStream(new FileInputStream(fullFileName));
			StreamingResponseBody stream = (os) -> {
				IOUtils.copy(acis, os);
				os.flush();
			};

			return ResponseEntity.ok()//
					.contentLength(file.length())//
					.header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + fileName + "\"")//
					.contentType(MediaType.parseMediaType(mimeType))//
					.body(stream);
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(MongoSession session, String nodeId,
			String disposition) {
		try {
			SubNode node = api.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeException("node not found: " + nodeId);
			}
			String fullFileName = node.getStringProp(TYPES.FS_LINK);
			File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeException("File not found: " + fullFileName);
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
			throw ExUtil.newEx(ex);
		}
	}

	public void getFileSystemResourceStreamMultiPart(MongoSession session, String nodeId, String disposition,
			HttpServletRequest request, HttpServletResponse response) {
		try {
			SubNode node = api.getNode(session, nodeId, false);
			if (node == null) {
				throw new RuntimeException("node not found: " + nodeId);
			}

			api.auth(session, node, PrivilegeType.READ);

			String fullFileName = node.getStringProp(TYPES.FS_LINK);
			File file = new File(fullFileName);

			if (!file.exists() || !file.isFile()) {
				throw new RuntimeException("File not found: " + fullFileName);
			}

			MultipartFileSender.fromPath(file.toPath()).with(request).with(response).with(disposition).serveResource();
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	/*
	 * Uploads an image attachment not from the user's machine but from some
	 * arbitrary internet URL they have provided, that could be pointing to an image
	 * or any other kind of content actually.
	 */
	public void uploadFromUrl(MongoSession session, UploadFromUrlRequest req, UploadFromUrlResponse res) {
		uploadFromUrl(session, req.getSourceUrl(), req.getNodeId(), null);
		res.setSuccess(true);
	}

	/**
	 * @param mimeHint This is an additional string invented because IPFS urls don't
	 *                 contain the file extension always and in that case we need to
	 *                 get it from the IPFS filename itself and that's what the hint
	 *                 is in that case. Normally however mimeHint is null
	 */
	public void uploadFromUrl(MongoSession session, String sourceUrl, String nodeId, String mimeHint) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		String FAKE_USER_AGENT = "Mozilla/5.0";

		/*
		 * todo-2: This value exists in properties file, and also in TypeScript
		 * variable. Need to have better way to define this ONLY in properties file.
		 */
		int maxFileSize = 20 * 1024 * 1024;
		LimitedInputStreamEx limitedIs = null;

		try {
			URL url = new URL(sourceUrl);

			String mimeType = URLConnection.guessContentTypeFromName(sourceUrl);
			if (StringUtils.isEmpty(mimeType)) {
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
				HttpClient client = HttpClientBuilder.create().build();
				HttpGet request = new HttpGet(sourceUrl);
				request.addHeader("User-Agent", FAKE_USER_AGENT);
				HttpResponse response = client.execute(request);
				log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
						+ response.getStatusLine().getReasonPhrase());
				InputStream is = response.getEntity().getContent();

				limitedIs = new LimitedInputStreamEx(is, maxFileSize);

				// insert 0L for size now, because we don't know it yet
				attachBinaryFromStream(session, null, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false, false);
			}
			/*
			 * if not an image extension, we can just stream directly into the database, but
			 * we want to try to get the mime type first, from calling detectImage so that
			 * if we do detect its an image we can handle it as one.
			 */
			else {
				if (!detectAndSaveImage(session, nodeId, sourceUrl, url)) {
					HttpClient client = HttpClientBuilder.create().build();
					HttpGet request = new HttpGet(sourceUrl);
					request.addHeader("User-Agent", FAKE_USER_AGENT);
					HttpResponse response = client.execute(request);
					log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
							+ response.getStatusLine().getReasonPhrase());
					InputStream is = response.getEntity().getContent();

					limitedIs = new LimitedInputStreamEx(is, maxFileSize);

					// insert 0L for size now, because we don't know it yet
					attachBinaryFromStream(session, null, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false, false);
				}
			}
		} catch (Exception e) {
			throw ExUtil.newEx(e);
		}
		/* finally block just for extra safety */
		finally {
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
					// log.debug("determined format name of image url: " +
					// formatName);
					reader.setInput(is, true, false);
					BufferedImage bufImg = reader.read(0);
					String mimeType = "image/" + formatName;

					ByteArrayOutputStream os = new ByteArrayOutputStream();
					ImageIO.write(bufImg, formatName, os);
					byte[] bytes = os.toByteArray();
					is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);

					attachBinaryFromStream(session, null, nodeId, fileName, bytes.length, is2, mimeType,
							bufImg.getWidth(null), bufImg.getHeight(null), false, false);
					return true;
				}
			}
		} catch (Exception e) {
			throw ExUtil.newEx(e);
		} finally {
			StreamUtil.close(is, is2, reader);
		}

		return false;
	}
}
