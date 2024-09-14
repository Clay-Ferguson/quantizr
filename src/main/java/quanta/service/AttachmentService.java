package quanta.service;

import java.awt.image.BufferedImage;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.apache.commons.io.IOUtils;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.client.gridfs.GridFSFindIterable;
import com.mongodb.client.gridfs.model.GridFSFile;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.ServiceBase;
import quanta.exception.OutOfSpaceException;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeInfo;
import quanta.model.UserStats;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.DeleteAttachmentRequest;
import quanta.rest.request.PasteAttachmentsRequest;
import quanta.rest.request.UploadFromUrlRequest;
import quanta.rest.response.DeleteAttachmentResponse;
import quanta.rest.response.PasteAttachmentsResponse;
import quanta.rest.response.UploadFromUrlResponse;
import quanta.rest.response.UploadResponse;
import quanta.rest.response.base.ResponseBase;
import quanta.service.imports.ImportZipService;
import quanta.util.Convert;
import quanta.util.ImageUtil;
import quanta.util.LimitedInputStream;
import quanta.util.LimitedInputStreamEx;
import quanta.util.MimeUtil;
import quanta.util.StreamUtil;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.IntVal;
import quanta.util.val.LongVal;

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
    private static Logger log = LoggerFactory.getLogger(AttachmentService.class);

    /*
     * todo-1: for troubleshooting purposes let's keep all gridfs items for a while, and so they'll show
     * up continually as orphans but that's fine
     */
    private static final boolean ALLOW_DELETES = false;

    // number of minutes in a day
    private static final int VERIFY_FREQUENCY_MINS = 60 * 24;

    @Autowired
    private GridFsTemplate grid;

    public UploadResponse cm_parseUploadFiles(MultipartFile[] uploadFiles) {
        UploadResponse resp = new UploadResponse();
        List<String> payloads = new LinkedList<String>();
        resp.setPayloads(payloads);
        long maxFileSize = svc_user.getUserStorageRemaining();

        for (MultipartFile uploadFile : uploadFiles) {
            String contentType = uploadFile.getContentType();
            // Right now we only support parsing EML files.
            if (!"message/rfc822".equals(contentType)) {
                continue;
            }

            try {
                LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);
                String mkdown = svc_email.convertEmailToMarkdown(limitedIs);
                payloads.add(mkdown);
            } catch (Exception e) {
                new RuntimeEx(e);
            }
        }
        return resp;
    }

    /*
     * Upload from User's computer. Standard HTML form-based uploading of a file from user machine
     */
    public ResponseBase uploadMultipleFiles(String attName, String nodeId, MultipartFile[] files, boolean explodeZips) {
        MongoTranMgr.ensureTran();
        if (nodeId == null) {
            throw new RuntimeEx("target nodeId not provided");
        }

        try {
            /*
             * NEW LOGIC: If the node itself currently has an attachment, leave it alone and just upload
             * UNDERNEATH this current node.
             */
            boolean allowEmailParse = false;
            SubNode node = svc_mongoRead.getNodeAP(nodeId);
            if (node == null) {
                throw new RuntimeEx("Node not found.");
            }
            svc_auth.ownerAuth(node);
            long maxFileSize = svc_user.getUserStorageRemaining();
            int imageCount = 0;

            /*
             * if uploading multiple files check quota first, to make sure there's space for all files before we
             * start uploading any of them If there's only one file, the normal flow will catch an out of space
             * problem, so we don't need to do it in advance in here as we do for multiple file uploads only.
             * 
             * Also we only do this check if not admin. Admin can upload unlimited amounts.
             */
            if (!TL.getSC().isAdmin() && files.length > 1) {
                AccountNode userNode = svc_user.getSessionUserAccount();
                // get how many bytes of storage the user currently holds
                Long binTotal = userNode.getInt(NodeProp.BIN_TOTAL);
                if (binTotal == null) {
                    binTotal = 0L;
                }
                // get max amount user is allowed
                Long userQuota = userNode.getInt(NodeProp.BIN_QUOTA);

                for (MultipartFile file : files) {
                    binTotal += file.getSize();
                    // check if user went over max and fail the API call if so.
                    if (binTotal > userQuota) {
                        throw new OutOfSpaceException();
                    }
                }
            }

            for (MultipartFile file : files) {
                String fileName = file.getOriginalFilename();
                String contentType = file.getContentType();
                if (contentType.startsWith("image/")) {
                    imageCount++;
                }
                long size = file.getSize();
                if (!StringUtils.isEmpty(fileName)) {
                    log.debug("Uploading file: " + fileName + " contentType=" + contentType);
                    LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(file.getInputStream(), maxFileSize);
                    // attaches AND closes the stream.
                    attachBinaryFromStream(false, attName, node, nodeId, fileName, size, limitedIs, contentType, -1, -1,
                            explodeZips, true, true, true, null, allowEmailParse, null);
                }
            }

            // if we have enough images to lay it out into a square of 3 cols switch to that
            // layout
            if (imageCount >= 9) {
                node.set(NodeProp.LAYOUT, "c3");
            }
            // switch to that layout. // otherwise, if we have enough images to lay it out
            // into a square of 2 cols
            else if (imageCount >= 2) {
                node.set(NodeProp.LAYOUT, "c2");
            }
            svc_mongoUpdate.saveSession();
        } catch (Exception e) {
            throw new RuntimeEx(e);
        }
        return new ResponseBase();
    }

    /*
     * Gets the binary attachment from a supplied stream and loads it into the repository on the node
     * specified in 'nodeId'
     */
    public void attachBinaryFromStream(boolean importMode, String attName, SubNode node, String nodeId, String fileName,
            long size, LimitedInputStreamEx is, String mimeType, int width, int height, boolean explodeZips,
            boolean calcImageSize, boolean closeStream, boolean storeLocally, String sourceUrl, boolean allowEmailParse,
            String aiPrompt) {
        // If caller already has 'node' it can pass node, and avoid looking up node again
        if (node == null && nodeId != null) {
            node = svc_mongoRead.getNode(nodeId);
        }
        svc_auth.ownerAuth(node);
        // mimeType can be passed as null if it's not yet determined
        if (mimeType == null) {
            mimeType = MimeUtil.getMimeFromFileType(fileName);
        }

        if (allowEmailParse && "message/rfc822".equals(mimeType)) {
            // this is EML file format.
            String mkdown = svc_email.convertEmailToMarkdown(is);
            node.setContent(mkdown);
            svc_mongoUpdate.save(node);
        } //
        else if (explodeZips && "application/zip".equalsIgnoreCase(mimeType)) {
            // This is a prototype-scope bean, with state for processing one import at a time
            ImportZipService importSvc = (ImportZipService) context.getBean(ImportZipService.class);
            importSvc.importFromStream(is, node, false);
        } //
        else {
            saveBinaryStreamToNode(importMode, attName, is, mimeType, fileName, size, width, height, node,
                    calcImageSize, closeStream, storeLocally, sourceUrl, aiPrompt);
        }
    }

    public void fixAllAttachmentMimes(SubNode node) {
        if (node == null || node.getAttachments() == null)
            return;
        node.getAttachments().forEach((String key, Attachment att) -> {
            String mimeType = att.getMime();
            // ensure we have the best mimeType we can if not set in the data.
            if (StringUtils.isEmpty(mimeType)) {
                String binUrl = att.getUrl();
                if (!StringUtils.isEmpty(binUrl)) {
                    mimeType = MimeUtil.getMimeTypeFromUrl(binUrl);
                    if (!StringUtils.isEmpty(mimeType)) {
                        att.setMime(mimeType);
                    }
                }
            }
        });
    }

    public void saveBinaryStreamToNode(boolean importMode, String attName, LimitedInputStreamEx inputStream,
            String mimeType, String fileName, long size, int width, int height, SubNode node, boolean calcImageSize,
            boolean closeStream, boolean storeLocally, String sourceUrl, String aiPrompt) {
        // NOTE: Setting this flag to false works just fine, and is more efficient, and will simply do
        // everything EXCEPT calculate the image size
        BufferedImage bufImg = null;
        byte[] imageBytes = null;
        InputStream isTemp = null;
        long maxFileSize = svc_user.getUserStorageRemaining();
        Attachment att = null;

        if (importMode) {
            att = node.getAttachment(attName, false, false);
            fileName = att.getFileName();

            if (StringUtils.isEmpty(fileName)) {
                fileName = "file";
            }
        }
        // if no attName given we try to use "primary", but if primary exists, we find a different name
        else {
            if (StringUtils.isEmpty(attName)
                    && node.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false) != null) {
                attName = getNextAttachmentKey(node);
            }
            int maxAttOrdinal = getMaxAttachmentOrdinal(node);
            att = node.getAttachment(attName, true, true);
            att.setOrdinal(maxAttOrdinal + 1);
            att.setAiPrompt(aiPrompt);
        }

        if (!importMode && ImageUtil.isImageMime(mimeType)) {
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
        }
        att.setMime(mimeType);

        AccountNode userNode = svc_user.getAccountNode(node.getOwner());
        if (imageBytes == null) {
            try {
                att.setSize(size);
                if (storeLocally) {
                    if (fileName != null) {
                        att.setFileName(fileName);
                    }
                    writeStream(importMode, attName, node, inputStream, fileName, mimeType, userNode);
                } else {
                    att.setUrl(sourceUrl);
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
                    if (fileName != null && aiPrompt == null) {
                        att.setFileName(fileName);
                    }
                    is = new LimitedInputStreamEx(new ByteArrayInputStream(imageBytes), maxFileSize);
                    writeStream(importMode, attName, node, is, fileName, mimeType, userNode);
                } else {
                    att.setUrl(sourceUrl);
                }
            } finally {
                StreamUtil.close(is);
            }
        }
        svc_mongoUpdate.save(node);
    }

    public String getNextAttachmentKey(SubNode node) {
        int imgIdx = 1;
        while (node.getAttachment("img" + String.valueOf(imgIdx), false, false) != null) {
            imgIdx++;
        }
        return "img" + String.valueOf(imgIdx);
    }

    // appends all the attachments from sourceNode onto targetNode, leaving targetNode as is
    public void mergeAttachments(SubNode sourceNode, SubNode targetNode) {
        if (sourceNode == null || targetNode == null)
            return;
        List<Attachment> atts = sourceNode.getOrderedAttachments();
        if (atts != null) {
            for (Attachment att : atts) {
                String newKey = getNextAttachmentKey(targetNode);
                att.setKey(newKey);
                targetNode.addAttachment(att);
            }
        }
    }

    public int getMaxAttachmentOrdinal(SubNode node) {
        int max = -1;
        if (node.getAttachments() != null) {
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
    public DeleteAttachmentResponse deleteAttachment(DeleteAttachmentRequest req) {
        MongoTranMgr.ensureTran();
        DeleteAttachmentResponse res = new DeleteAttachmentResponse();
        String nodeId = req.getNodeId();
        SubNode node = svc_mongoRead.getNode(nodeId);
        svc_auth.ownerAuth(node);

        final List<String> attKeys = XString.tokenize(req.getAttName(), ",", true);
        if (attKeys != null) {
            for (String attKey : attKeys) {
                log.debug("User " + TL.getSC().getUserName() + " deleting attachment: " + attKey + " from nodeId: "
                        + nodeId);
                deleteBinary(attKey, node, null, false);
            }
        }
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
    public void getBinary(String attName, SubNode node, String nodeId, String binId, boolean download,
            HttpServletResponse response) {
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;
        try {
            if (node == null) {
                node = svc_mongoRead.getNodeAP(nodeId);
            } else {
                nodeId = node.getIdStr();
            }
            if (node == null) {
                throw new RuntimeEx("node not found.");
            }
            Attachment att = null;
            if (node.getAttachments() != null) {
                for (String key : node.getAttachments().keySet()) {
                    Attachment curAtt = node.getAttachments().get(key);
                    if (curAtt.getBin() != null && curAtt.getBin().equals(binId)) {
                        att = curAtt;
                        attName = key;
                        break;
                    }
                }
            }
            if (att == null) {
                att = node.getAttachment(attName, false, false);
                if (att == null) {
                    throw new RuntimeEx("attachment info not found.");
                }
            }

            String mimeTypeProp = att.getMime();
            if (mimeTypeProp == null) {
                throw new RuntimeEx("unable to find mimeType property");
            }
            String fileName = att.getFileName();
            if (fileName == null) {
                fileName = "filename";
            }

            // We always allow access to account nodes becasue they only contain avatars and header images.
            InputStream is = svc_auth.isAnAccountNode(node) ? getStreamAP(attName, node) : getStream(attName, node);
            if (is == null) {
                throw new RuntimeEx("Image not found.");
            }
            long size = att.getSize();
            response.setContentType(mimeTypeProp);
            /*
             * we gracefully tolerate the case where no size is available but normally it will be there.
             * 
             * todo-2: when we detect this and then stream back some data should we just go ahead and SET the
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
                 * Chrome shows this: Failed to load resource: net::ERR_CONTENT_LENGTH_MISMATCH
                 */
                response.setContentLength((int) size);
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
    public void cm_getFile(String fileName, String disposition, HttpServletResponse response) {
        if (fileName.contains(".."))
        throw new RuntimeEx("bad request.");
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;
        try {
            String fullFileName = svc_prop.getAdminDataFolder() + File.separator + fileName;
            File file = new File(fullFileName);
            String checkPath = file.getCanonicalPath();
            if (!checkPath.startsWith(svc_prop.getAdminDataFolder()))
                throw new RuntimeEx("bad request.");
            if (!file.isFile())
                throw new RuntimeEx("file not found.");
            String mimeType = MimeUtil.getMimeType(file);
            if (disposition == null) {
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
            throw new RuntimeEx(ex);
        } finally {
            StreamUtil.close(inStream, outStream);
        }
    }

    public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(String nodeId, String disposition) {
        if (!TL.hasAdminPrivileges()) {
            throw new RuntimeEx("unauthorized");
        }
        try {
            SubNode node = svc_mongoRead.getNodeAP(nodeId);
            if (node == null) {
                throw new RuntimeEx("node not found: " + nodeId);
            }
            String fullFileName = node.getStr(NodeProp.FS_LINK);
            File file = new File(fullFileName);
            if (!file.exists() || !file.isFile()) {
                throw new RuntimeEx("File not found: " + fullFileName);
            }
            String mimeType = MimeUtil.getMimeType(file);
            if (disposition == null) {
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
            StreamingResponseBody stream = os -> {
                IOUtils.copy(acis, os);
                os.flush();
            };
            return ResponseEntity.ok().contentLength(file.length())
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + file.getName() + "\"")
                    .contentType(MediaType.parseMediaType(mimeType)).body(stream);
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        }
    }

    public Object cm_getStreamResource(HttpHeaders headers, String nodeId, String attName) {
        BufferedInputStream inStream = null;
        ResponseEntity<ResourceRegion> ret = null;

        try {
            SubNode node = svc_mongoRead.getNodeAP(nodeId);
            if (node == null) {
                throw new RuntimeEx("node not found.");
            }

            Attachment att = node.getAttachment(attName, false, false);
            if (att == null)
                throw new RuntimeEx("no attachment info found");
            svc_auth.readAuth(node);
            String mimeTypeProp = att.getMime();
            if (mimeTypeProp == null) {
                throw new RuntimeEx("unable to find mimeType property");
            }
            String fileName = att.getFileName();
            if (fileName == null) {
                fileName = "filename";
            }
            InputStream is = getStream(attName, node);
            long size = att.getSize();
            if (size == 0) {
                throw new RuntimeEx("Can't stream video without the file size. BIN_SIZE property missing");
            }
            inStream = new BufferedInputStream(is);
            byte[] bytes = IOUtils.toByteArray(inStream);
            ResourceRegion region = resourceRegion(new ByteArrayResource(bytes), headers);
            ret = ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).contentType(MediaType.valueOf(mimeTypeProp))
                    .body(region);
        } catch (Exception e) {
            log.error(e.getMessage());
        } finally {
            StreamUtil.close(inStream);
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
        if (httpRange != null) {
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
    public UploadFromUrlResponse cm_readFromUrl(UploadFromUrlRequest req) {
        UploadFromUrlResponse res = new UploadFromUrlResponse();
        if (req.getSourceUrl() != null) {
            readFromUrl(req.getSourceUrl(), null, req.getNodeId(), null, null, 0, req.isStoreLocally(), null);
        }
        return res;
    }

    /**
     * 'inputStream' is a retrofit to this function for when we want to just call this method and get an
     * inputStream handed back that can be read from. Normally the inputStream Val is null and not used.
     *
     * NOTE: If 'node' is already available caller should pass it, or else can pass nodeId.
     */
    public void readFromUrl(String sourceUrl, SubNode node, String nodeId, String mimeHint, String mimeType,
            int maxFileSize, boolean storeLocally, String aiPrompt) {
        if (mimeType == null) {
            mimeType = MimeUtil.getMimeTypeFromUrl(sourceUrl);
            if (StringUtils.isEmpty(mimeType) && mimeHint != null) {
                mimeType = URLConnection.guessContentTypeFromName(mimeHint);
            }
        }
        if (node == null) {
            node = svc_mongoRead.getNode(nodeId);
        }

        // only need to auth if we looked up the node.
        svc_auth.ownerAuth(node);
        String attKey = getNextAttachmentKey(node);
        if (!storeLocally) {
            int maxOrd = getMaxAttachmentOrdinal(node);
            Attachment att = node.getAttachment(attKey, true, true);
            if (mimeType != null) {
                att.setMime(mimeType);
            }
            att.setUrl(sourceUrl);
            att.setOrdinal(maxOrd + 1);
            return;
        }

        if (maxFileSize <= 0) {
            maxFileSize = svc_user.getUserStorageRemaining();
        }

        LimitedInputStreamEx limitedIs = null;
        try {
            URL url = new URI(sourceUrl).toURL();
            int timeout = 20;
            // if this is an image extension, handle it in a special way, mainly to extract the width, height
            // from it
            if (ImageUtil.isImageMime(mimeType)) {
                limitedIs = StreamUtil.getLimitedStream(sourceUrl, timeout, maxFileSize);

                // insert 0L for size now, because we don't know it yet
                attachBinaryFromStream(false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1, false,
                        true, true, storeLocally, sourceUrl, false, aiPrompt);
            }
            /*
             * if not an image extension, we can just stream directly into the database, but we want to try to
             * get the mime type first, from calling detectImage so that if we do detect its an image we can
             * handle it as one.
             */
            else {
                if (!detectAndSaveImage(nodeId, attKey, sourceUrl, url, storeLocally)) {
                    limitedIs = StreamUtil.getLimitedStream(sourceUrl, timeout, maxFileSize);

                    // insert 0L for size now, because we don't know it yet
                    attachBinaryFromStream(false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false,
                            true, true, storeLocally, sourceUrl, false, aiPrompt);
                }
            }
        } catch (Exception e) {
            throw new RuntimeEx(e);
        } finally {
            /*
             * finally block just for extra safety this stream will have been closed by 'attachBinaryFromStream'
             * but we close here too anyway.
             */
            StreamUtil.close(limitedIs);
        }
    }

    /*
     * FYI: Warning: this way of getting content type doesn't work. String mimeType =
     * URLConnection.guessContentTypeFromStream(inputStream);
     * 
     * returns true if it was detected AND saved as an image
     */
    private boolean detectAndSaveImage(String nodeId, String attKey, String sourceUrl, URL url, boolean storeLocally) {
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
                    reader.setInput(is, true, false);
                    String mimeType = "image/" + formatName;
                    BufferedImage bufImg = reader.read(0);
                    ByteArrayOutputStream os = new ByteArrayOutputStream();
                    ImageIO.write(bufImg, formatName, os);
                    byte[] bytes = os.toByteArray();
                    is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);
                    attachBinaryFromStream(false, attKey, null, nodeId, sourceUrl, bytes.length, is2, mimeType,
                            bufImg.getWidth(null), bufImg.getHeight(null), false, true, true, storeLocally, sourceUrl,
                            false, null);
                    return true;
                }
            }
        } catch (Exception e) {
            throw new RuntimeEx(e);
        } finally {
            StreamUtil.close(is, is2, reader);
        }
        return false;
    }

    public void writeStream(boolean importMode, String attName, SubNode node, LimitedInputStreamEx stream,
            String fileName, String mimeType, AccountNode userNode) {
        // don't create attachment here, there shuold already be one, but we pass create=true anyway
        Attachment att = node.getAttachment(attName, !importMode, false);
        svc_auth.ownerAuth(node);
        DBObject metaData = new BasicDBObject();
        metaData.put("nodeId", node.getId());
        if (userNode == null) {
            userNode = svc_user.getSessionUserAccount();
        }

        String id = grid.store(stream, fileName, mimeType, metaData).toString();
        long streamCount = stream.getCount();
        // update the user quota which enforces their total storage limit
        if (!TL.hasAdminPrivileges()) {
            svc_user.addBytesToUserNodeBytes(streamCount, userNode);
        }
        if (userNode == null) {
            throw new RuntimeEx("User not found.");
        }
        // Now save the node also since the property on it needs to point to GridFS id
        att.setBin(id);
        att.setSize(streamCount);
        att.setMime(mimeType);
    }

    /*
     * Assumes owner 'ms' has already been auth-checked for owning this node. If 'gridOnly' is true that
     * means we should only delete from the GRID DB, and not touch any of the properties on the node
     * itself
     */
    public void deleteBinary(String attName, SubNode node, AccountNode userNode, boolean gridOnly) {
        if (node == null)
            return;
        HashMap<String, Attachment> attachments = node.getAttachments();
        if (attachments == null)
            return;
        Attachment att = attachments.get(attName);
        if (att == null)
            return;
        if (!gridOnly) {
            attachments.remove(attName);
            node.setAttachments(attachments);
        }
        if (!TL.hasAdminPrivileges()) {
            long totalBytes = svc_attach.getTotalAttachmentBytes(node);
            svc_user.addBytesToUserNodeBytes(-totalBytes, userNode);
        }
        log.debug("  deleteBinary gridId=" + att.getBin() + " leaving for orphan cleanup");

        // DO NOT DELETE THE GRID ITEM, we leave it for orphan cleanup. This will make the app faster, but
        // it's fine because orphan cleanup will eventually clean it up.
        // BUT....LEAVE THIS CODE HERE
        // Criteria crit = Criteria.where("_id").is(att.getBin());
        // crit = svc_auth.addWriteSecurity(ms, crit);
        // grid.delete(new Query(crit));
    }

    public InputStream getStreamAP(String attName, SubNode node) {
        return svc_arun.run(() -> getStream(attName, node));
    }

    public InputStream getStream(String attName, SubNode node) {
        svc_auth.readAuth(node);
        Attachment att = node.getAttachment(attName, false, false);
        if (att == null)
            return null;
        InputStream is = getStreamByNode(node, attName);
        return is;
    }

    public InputStream getStreamByNode(SubNode node, String attName) {
        if (node == null)
            return null;
        Attachment att = node.getAttachment(attName, false, false);
        if (att == null || att.getBin() == null)
            return null;
        GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(att.getBin())));

        if (gridFile == null) {
            log.debug("gridfs ID not found");
            return null;
        }

        GridFsResource gridFsResource = grid.getResource(gridFile);
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

    @SuppressWarnings("unused")
    public int getGridItemCount() {
        return svc_arun.run(() -> {
            int count = 0;
            GridFSFindIterable files = grid.find(new Query());
            // Scan all files in the grid
            if (files != null) {
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

    int verifyAllAttachments_runCount = 0;

    @Scheduled(fixedDelay = VERIFY_FREQUENCY_MINS * 60 * 1000)
    public String verifyAllAttachments() {
        return svc_arun.run(() -> {
            verifyAllAttachments_runCount++;

            // This first run will happen at startup and we don't want that.
            if (verifyAllAttachments_runCount == 1) {
                log.debug("verifyAllAttachments() first run, skipping.");
                return "";
            }
            log.debug("verifyAllAttachments()");
            StringBuilder sb = new StringBuilder();
            IntVal nodesFound = new IntVal(0);
            List<String> nodesIdsMissingBins = new ArrayList<>();

            // iterate stream of all nodes
            // get all nodes that have attachments
            Criteria crit = Criteria.where(SubNode.ATTACHMENTS).exists(true);
            Query query = new Query();
            query.addCriteria(crit);

            svc_ops.forEach(query, n -> {
                n.getAttachments().forEach((String key, Attachment att) -> {
                    if (att.getBin() != null) {
                        GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(att.getBin())));
                        if (gridFile == null) {
                            log.debug("NodeId=" + n.getIdStr() + " Has Missing Binary: " + att.getBin());
                            nodesIdsMissingBins.add(n.getIdStr());
                        } else {
                            nodesFound.inc();
                        }
                    }
                });
            });

            verifyAllAttachments_runCount++;
            sb.append("GridFS Attachment Verification (run=" + verifyAllAttachments_runCount + ")\n");
            sb.append("  Binaries In Use: " + nodesFound.getVal() + "\n");
            sb.append("  Nodes Missing Attachments: " + nodesIdsMissingBins.size() + "\n");
            nodesIdsMissingBins.forEach(id -> {
                sb.append("    " + id + "\n");
            });

            if (nodesIdsMissingBins.size() > 0) {
                svc_email.sendDevEmail("Missing Attachments", sb.toString());
            }
            sb.append("\n\n");
            return sb.toString();
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
    public String gridMaintenanceScan() {
        MongoTranMgr.ensureTran();
        log.debug("gridMaintenanceScan()");
        return svc_arun.run(() -> {
            StringBuilder sb = new StringBuilder();
            int delCount = 0;
            HashMap<ObjectId, UserStats> statsMap = new HashMap<>();

            // query all grid items
            GridFSFindIterable files = grid.find(new Query());
            if (files != null) {
                boolean delete = true;

                // Scan all files in the grid
                for (GridFSFile file : files) {
                    // by default we delete the grid item unless we reach discover it is being used
                    delete = true;
                    Document meta = file.getMetadata();
                    String binId = file.getObjectId().toHexString();;
                    String nodeIdStr = null;
                    // if node has metadata
                    if (meta != null) {
                        // Get which nodeId owns this grid file
                        ObjectId nodeId = (ObjectId) meta.get("nodeId");
                        if (nodeId != null) {
                            nodeIdStr = nodeId.toHexString();
                            SubNode node = svc_mongoRead.getNode(nodeIdStr);

                            // did we find the node that owns this grid item
                            if (node != null) {
                                // scan all attachments on the node to look for the actual attachment
                                // that uses this grid item
                                if (node.getAttachments() != null) {
                                    // scan all attachments to see if we have one pointing to binId
                                    for (String key : node.getAttachments().keySet()) {
                                        Attachment att = node.getAttachments().get(key);

                                        // if this attachment is in use, then don't delete the grid item
                                        if (att.getBin() != null && att.getBin().equals(binId)) {
                                            // log.debug("Grid Item Found: " + binId
                                            // + " on node: " + node.getIdStr() + " with att.key: " + key);
                                            delete = false;
                                            break;
                                        }
                                    }
                                }

                                if (!delete) {
                                    // update the UserStats by adding the file length to the total for this user
                                    UserStats stats = statsMap.get(node.getOwner());

                                    // if our map doesn't have this user yet, then create a new UserStats object
                                    if (stats == null) {
                                        stats = new UserStats();
                                        stats.binUsage = file.getLength();
                                        statsMap.put(node.getOwner(), stats);
                                    }
                                    // else update the binUsage on the UserStats object
                                    else {
                                        stats.binUsage = stats.binUsage.longValue() + file.getLength();
                                    }
                                }
                            }
                        }
                    }

                    if (delete) {
                        String msg = "Grid Orphan: binId=" + binId + " nodeId=" + nodeIdStr;
                        sb.append(msg + "\n");
                        log.debug(msg);

                        if (ALLOW_DELETES) {
                            Query q = new Query(Criteria.where("_id").is(binId));
                            grid.delete(q);
                        }
                        delCount++;
                    }
                }
            }

            /*
             * All UserStats will now be updated in loop above for all users that do have some attachment space
             * consumed. So now we scan all userAccountNodes, and set a zero amount for those that don't already
             * exist in the map
             */
            Iterable<SubNode> accntNodes = svc_user.getAccountNodes(null, null, null, -1);
            for (SubNode accntNode : accntNodes) {
                // log.debug("Processing Account Node: id=" + accntNode.getIdStr());
                UserStats stats = statsMap.get(accntNode.getOwner());
                if (stats == null) {
                    stats = new UserStats();
                    stats.binUsage = 0L;
                    statsMap.put(accntNode.getOwner(), stats);
                }
            }
            sb.append(String.valueOf(delCount) + " grid orphans found.\n\n");
            String ret = sb.toString();
            log.debug(ret);
            svc_user.writeUserStats(statsMap);
            return ret;
        });
    }

    /*
     * An alternative way to get the binary attachment from a node allowing more friendly url format
     * (named nodes).
     */
    public void cm_getAttachment(String nameOnAdminNode, String nameOnUserNode, String userName, String id,
            String download, String gid, String attName, HttpServletRequest req, HttpServletResponse response) {

        if (StringUtils.isEmpty(attName)) {
            attName = Constant.ATTACHMENT_PRIMARY.s();
        }

        // Node Names are identified using a colon in front of it, to make it detectable
        if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
            id = ":" + userName + ":" + nameOnUserNode;
        } //
        else if (!StringUtils.isEmpty(nameOnAdminNode)) {
            id = ":" + nameOnAdminNode;
        }

        if (id == null) {
            throw new RuntimeEx("No ID specified.");
        }

        // we don't check ownership of node at this time, but merely check sanity of
        // whether this ID is even existing or not.
        SubNode node = svc_mongoRead.getNode(id);
        if (node == null) {
            throw new RuntimeEx("Node not found.");
        }

        svc_attach.getBinary(attName, node, null, null, download != null, response);
    }

    /*
     * binId param not uses currently but the client will send either the gridId of the node depending
     * on which type of attachment it sees on the node
     */
    public void cm_getBinary(String binId, String nodeId, String download, HttpSession session,
            HttpServletResponse response) {

        log.debug("getBinary: session.id=" + session.getId() + " binId=" + binId + " nodeId=" + nodeId + " download="
                + download);

        SubNode node = svc_mongoRead.getNodeAP(nodeId);
        if (node == null) {
            throw new RuntimeEx("Node not found.");
        }

        // if node is account node we can get ANY attachments from it.
        if (node.isType(NodeType.ACCOUNT)) {
            String attName = null;
            if ("avatar".equals(binId)) {
                attName = Constant.ATTACHMENT_PRIMARY.s();
            } //
            else if ("profileHeader".equals(binId)) {
                attName = Constant.ATTACHMENT_HEADER.s();
            }

            final String _attName = attName;
            // Access as Admin because all account node attachments are always public.
            svc_arun.run(() -> {
                svc_attach.getBinary(_attName, null, nodeId, binId, download != null, response);
                return null;
            });
        }
        // Else if not an account node, do a normal thread-based secure access.
        else {
            svc_attach.getBinary(null, null, nodeId, binId, download != null, response);
        }
    }

    public long getTotalAttachmentBytes(SubNode node) {
        LongVal totalBytes = new LongVal();
        if (node != null && node.getAttachments() != null) {
            node.getAttachments().forEach((String key, Attachment att) -> {
                if (att.getSize() > 0L) {
                    totalBytes.add(att.getSize());
                }
            });
        }
        return totalBytes.getVal();
    }

    public PasteAttachmentsResponse pasteAttachments(PasteAttachmentsRequest req) {
        MongoTranMgr.ensureTran();
        PasteAttachmentsResponse res = new PasteAttachmentsResponse();
        SubNode sourceNode = svc_mongoRead.getNode(req.getSourceNodeId());
        if (sourceNode == null) {
            throw new RuntimeEx("source node not found");
        }

        SubNode targetNode = svc_mongoRead.getNode(req.getTargetNodeId());
        if (targetNode == null) {
            throw new RuntimeEx("target node not found");
        }

        for (String attName : req.getKeys()) {
            Attachment att = sourceNode.getAttachment(attName, false, false);
            if (att == null) {
                throw new RuntimeEx("attachment not found: " + attName);
            }
            String newKey = getNextAttachmentKey(targetNode);
            att.setKey(newKey);
            targetNode.addAttachment(att);
            sourceNode.getAttachments().remove(attName);
        }

        svc_mongoUpdate.save(targetNode);
        svc_mongoUpdate.save(sourceNode);

        NodeInfo newNodeInfo = svc_convert.toNodeInfo(false, TL.getSC(), targetNode, false,
                Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, true, null);
        if (newNodeInfo != null) {
            res.setTargetNode(newNodeInfo);
        }

        List<String> sigDirtyNodes = new LinkedList<>();
        sigDirtyNodes.add(targetNode.getIdStr());
        sigDirtyNodes.add(sourceNode.getIdStr());
        return res;
    }
}
