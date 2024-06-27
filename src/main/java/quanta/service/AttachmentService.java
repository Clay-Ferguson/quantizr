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
import java.net.URL;
import java.net.URLConnection;
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
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.AIGenImageRequest;
import quanta.request.AIGenSpeechRequest;
import quanta.request.DeleteAttachmentRequest;
import quanta.request.PasteAttachmentsRequest;
import quanta.request.UploadFromUrlRequest;
import quanta.response.AIGenImageResponse;
import quanta.response.AIGenSpeechResponse;
import quanta.response.DeleteAttachmentResponse;
import quanta.response.PasteAttachmentsResponse;
import quanta.response.UploadFromUrlResponse;
import quanta.response.UploadResponse;
import quanta.response.base.ResponseBase;
import quanta.service.imports.ImportZipService;
import quanta.util.Convert;
import quanta.util.ExUtil;
import quanta.util.ImageUtil;
import quanta.util.LimitedInputStream;
import quanta.util.LimitedInputStreamEx;
import quanta.util.MimeTypeUtils;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;
import quanta.util.Util;
import quanta.util.XString;
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

    @Autowired
    public GridFsTemplate grid;

    public UploadResponse parseUploadFiles(MongoSession ms, MultipartFile[] uploadFiles) {
        UploadResponse resp = new UploadResponse();
        List<String> payloads = new LinkedList<String>();
        resp.setPayloads(payloads);
        long maxFileSize = user.getUserStorageRemaining(ms);

        for (MultipartFile uploadFile : uploadFiles) {
            String contentType = uploadFile.getContentType();
            // Right now we only support parsing EML files.
            if (!"message/rfc822".equals(contentType)) {
                continue;
            }

            try {
                LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(uploadFile.getInputStream(), maxFileSize);
                String mkdown = email.convertEmailToMarkdown(limitedIs);
                payloads.add(mkdown);
            } catch (Exception e) {
                throw ExUtil.wrapEx(e);
            }
        }
        return resp;
    }

    /*
     * Upload from User's computer. Standard HTML form-based uploading of a file from user machine
     */
    public ResponseBase uploadMultipleFiles(MongoSession ms, String attName, String nodeId, MultipartFile[] files,
            boolean explodeZips) {
        if (nodeId == null) {
            throw ExUtil.wrapEx("target nodeId not provided");
        }

        try {
            /*
             * NEW LOGIC: If the node itself currently has an attachment, leave it alone and just upload
             * UNDERNEATH this current node. Pass allowAuth=false here because below we check the ownerAuth
             * which will be even more strict.
             */
            boolean allowEmailParse = false;
            SubNode node = read.getNode(ms, nodeId, false, null);
            if (node == null) {
                throw ExUtil.wrapEx("Node not found.");
            }
            auth.ownerAuth(node);
            long maxFileSize = user.getUserStorageRemaining(ms);
            int imageCount = 0;

            /*
             * if uploading multiple files check quota first, to make sure there's space for all files before we
             * start uploading any of them If there's only one file, the normal flow will catch an out of space
             * problem, so we don't need to do it in advance in here as we do for multiple file uploads only.
             * 
             * Also we only do this check if not admin. Admin can upload unlimited amounts.
             */
            if (!ms.isAdmin() && files.length > 1) {
                SubNode userNode = read.getAccountByUserName(null, null, false);
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
                    attachBinaryFromStream(ms, false, attName, node, nodeId, fileName, size, limitedIs, contentType, -1,
                            -1, explodeZips, true, true, true, null, allowEmailParse, null);
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
            update.saveSession(ms);
        } catch (Exception e) {
            throw ExUtil.wrapEx(e);
        }
        return new ResponseBase();
    }

    /*
     * Gets the binary attachment from a supplied stream and loads it into the repository on the node
     * specified in 'nodeId'
     */
    public void attachBinaryFromStream(MongoSession ms, boolean importMode, String attName, SubNode node, String nodeId,
            String fileName, long size, LimitedInputStreamEx is, String mimeType, int width, int height,
            boolean explodeZips, boolean calcImageSize, boolean closeStream, boolean storeLocally, String sourceUrl,
            boolean allowEmailParse, String aiPrompt) {
        // If caller already has 'node' it can pass node, and avoid looking up node again
        if (node == null && nodeId != null) {
            node = read.getNode(ms, nodeId);
        }
        auth.ownerAuth(ms, node);
        // mimeType can be passed as null if it's not yet determined
        if (mimeType == null) {
            mimeType = Util.getMimeFromFileType(fileName);
        }
        if (allowEmailParse && "message/rfc822".equals(mimeType)) {
            // this is EML file format.
            String mkdown = email.convertEmailToMarkdown(is);
            node.setContent(mkdown);
            update.save(ms, node);
        } //
        else if (explodeZips && "application/zip".equalsIgnoreCase(mimeType)) {
            // This is a prototype-scope bean, with state for processing one import at a time
            ImportZipService importSvc = (ImportZipService) context.getBean(ImportZipService.class);
            importSvc.importFromStream(ms, is, node, false);
        } //
        else {
            saveBinaryStreamToNode(ms, importMode, attName, is, mimeType, fileName, size, width, height, node,
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
                    mimeType = Util.getMimeTypeFromUrl(binUrl);
                    if (!StringUtils.isEmpty(mimeType)) {
                        att.setMime(mimeType);
                    }
                }
            }
        });
    }

    public void saveBinaryStreamToNode(MongoSession ms, boolean importMode, String attName,
            LimitedInputStreamEx inputStream, String mimeType, String fileName, long size, int width, int height,
            SubNode node, boolean calcImageSize, boolean closeStream, boolean storeLocally, String sourceUrl,
            String aiPrompt) {
        // NOTE: Setting this flag to false works just fine, and is more efficient, and will simply do
        // everything EXCEPT calculate the image size
        BufferedImage bufImg = null;
        byte[] imageBytes = null;
        InputStream isTemp = null;
        long maxFileSize = user.getUserStorageRemaining(ms);
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
        if (imageBytes == null) {
            try {
                att.setSize(size);
                if (storeLocally) {
                    if (fileName != null) {
                        att.setFileName(fileName);
                    }
                    writeStream(ms, importMode, attName, node, inputStream, fileName, mimeType, userNode);
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
                    writeStream(ms, importMode, attName, node, is, fileName, mimeType, userNode);
                } else {
                    att.setUrl(sourceUrl);
                }
            } finally {
                StreamUtil.close(is);
            }
        }
        update.save(ms, node);
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
    public DeleteAttachmentResponse deleteAttachment(MongoSession ms, DeleteAttachmentRequest req) {
        DeleteAttachmentResponse res = new DeleteAttachmentResponse();
        String nodeId = req.getNodeId();
        SubNode node = read.getNode(ms, nodeId);
        auth.ownerAuth(node);
        final List<String> attKeys = XString.tokenize(req.getAttName(), ",", true);
        if (attKeys != null) {
            for (String attKey : attKeys) {
                deleteBinary(ms, attKey, node, null, false);
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
    public void getBinary(MongoSession ms, String attName, SubNode node, String nodeId, String binId, boolean download,
            HttpServletResponse response) {
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;
        try {
            ms = ThreadLocals.ensure(ms);
            if (node == null) {
                node = read.getNode(ms, nodeId, false, null);
            } else {
                nodeId = node.getIdStr();
            }
            if (node == null) {
                throw ExUtil.wrapEx("node not found.");
            }
            Attachment att = null;
            // todo-2: put this in a method (finding attachment by binId)
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
                    throw ExUtil.wrapEx("attachment info not found.");
                }
            }
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
            if (mimeTypeProp == null) {
                throw ExUtil.wrapEx("unable to find mimeType property");
            }
            String fileName = att.getFileName();
            if (fileName == null) {
                fileName = "filename";
            }

            InputStream is = getStream(ms, attName, node, allowAuth);
            if (is == null) {
                throw new RuntimeException("Image not found.");
            }
            long size = att.getSize();
            response.setContentType(mimeTypeProp);
            // we gracefully tolerate the case where no size is available but normally it will be there.
            //
            // todo-2: when we detect this and then stream back some data should be just go ahead and SET the
            // correct 'size' on the node at that point?
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
            throw ExUtil.wrapEx(ex);
        } finally {
            StreamUtil.close(inStream, outStream);
        }
    }

    public ResponseEntity<StreamingResponseBody> getFileSystemResourceStream(MongoSession ms, String nodeId,
            String disposition) {
        if (!ms.isAdmin()) {
            throw new RuntimeEx("unauthorized");
        }
        try {
            SubNode node = read.getNode(ms, nodeId, false, null);
            if (node == null) {
                throw new RuntimeEx("node not found: " + nodeId);
            }
            String fullFileName = node.getStr(NodeProp.FS_LINK);
            File file = new File(fullFileName);
            if (!file.exists() || !file.isFile()) {
                throw new RuntimeEx("File not found: " + fullFileName);
            }
            String mimeType = MimeTypeUtils.getMimeType(file);
            if (disposition == null) {
                disposition = "inline";
            }
            // I think we could be using the MultipartFileSender here, eventually but not until we decople it
            // from reading directly from filesystem
            AutoCloseInputStream acis = new AutoCloseInputStream(new FileInputStream(fullFileName));
            // I'm not sure if FileSystemResource is better than StreamingResponseBody, but i do know
            // StreamingResponseBody does EXACTLY what is needed which is to use a small buffer size and never
            // hold entire media file all in memory
            StreamingResponseBody stream = os -> {
                IOUtils.copy(acis, os);
                os.flush();
            };
            return ResponseEntity.ok().contentLength(file.length())
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + file.getName() + "\"")
                    .contentType(MediaType.parseMediaType(mimeType)).body(stream);
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        }
    }

    public Object getStreamResource(MongoSession ms, HttpHeaders headers, String nodeId, String attName) {
        BufferedInputStream inStream = null;
        ResponseEntity<ResourceRegion> ret = null;

        try {
            SubNode node = read.getNode(ms, nodeId, false, null);
            if (node == null) {
                throw ExUtil.wrapEx("node not found.");
            }

            Attachment att = node.getAttachment(attName, false, false);
            if (att == null)
                throw ExUtil.wrapEx("no attachment info found");
            auth.auth(ms, node, PrivilegeType.READ);
            String mimeTypeProp = att.getMime();
            if (mimeTypeProp == null) {
                throw ExUtil.wrapEx("unable to find mimeType property");
            }
            String fileName = att.getFileName();
            if (fileName == null) {
                fileName = "filename";
            }
            InputStream is = getStream(ms, attName, node, false);
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
    public UploadFromUrlResponse readFromUrl(MongoSession ms, UploadFromUrlRequest req) {
        UploadFromUrlResponse res = new UploadFromUrlResponse();
        if (req.getSourceUrl() != null) {
            readFromUrl(ms, req.getSourceUrl(), null, req.getNodeId(), null, null, 0, req.isStoreLocally(), null);
        }
        return res;
    }

    public AIGenImageResponse aiGenImage(MongoSession ms, AIGenImageRequest req) {
        AIGenImageResponse res = new AIGenImageResponse();
        String url = oai.generateImage(ms, req.getOpenAiPrompt(), req.isHighDef(), req.getSize());
        readFromUrl(ms, url, null, req.getNodeId(), null, null, 0, true, req.getOpenAiPrompt());
        return res;
    }

    public AIGenSpeechResponse aiGenSpeech(MongoSession ms, AIGenSpeechRequest req) {
        AIGenSpeechResponse res = new AIGenSpeechResponse();
        oai.generateSpeech(ms, req.getOpenAiPrompt(), req.getVoice(), req.getNodeId());
        return res;
    }

    /**
     * 'inputStream' is a retrofit to this function for when we want to just call this method and get an
     * inputStream handed back that can be read from. Normally the inputStream Val is null and not used.
     *
     * NOTE: If 'node' is already available caller should pass it, or else can pass nodeId.
     */
    public void readFromUrl(MongoSession ms, String sourceUrl, SubNode node, String nodeId, String mimeHint,
            String mimeType, int maxFileSize, boolean storeLocally, String aiPrompt) {
        if (mimeType == null) {
            mimeType = Util.getMimeTypeFromUrl(sourceUrl);
            if (StringUtils.isEmpty(mimeType) && mimeHint != null) {
                mimeType = URLConnection.guessContentTypeFromName(mimeHint);
            }
        }
        if (node == null) {
            node = read.getNode(ms, nodeId);
        }

        // only need to auth if we looked up the node.
        auth.ownerAuth(node);
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
            maxFileSize = user.getUserStorageRemaining(ms);
        }

        ms = ThreadLocals.ensure(ms);
        LimitedInputStreamEx limitedIs = null;
        try {
            URL url = new URL(sourceUrl);
            int timeout = 20;
            // if this is an image extension, handle it in a special way, mainly to extract the width, height
            // from it
            if (ImageUtil.isImageMime(mimeType)) {
                limitedIs = StreamUtil.getLimitedStream(sourceUrl, timeout, maxFileSize);

                // insert 0L for size now, because we don't know it yet
                attachBinaryFromStream(ms, false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, mimeType, -1, -1,
                        false, true, true, storeLocally, sourceUrl, false, aiPrompt);
            }
            // if not an image extension, we can just stream directly into the database, but we want to try to
            // get the mime type first, from calling detectImage so that if we do detect its an image we can
            // handle it as one.
            else {
                if (!detectAndSaveImage(ms, nodeId, attKey, sourceUrl, url, storeLocally)) {
                    limitedIs = StreamUtil.getLimitedStream(sourceUrl, timeout, maxFileSize);

                    // insert 0L for size now, because we don't know it yet
                    attachBinaryFromStream(ms, false, attKey, node, nodeId, sourceUrl, 0L, limitedIs, "", -1, -1, false,
                            true, true, storeLocally, sourceUrl, false, aiPrompt);
                }
            }
        } catch (Exception e) {
            throw ExUtil.wrapEx(e);
        } finally {
            // finally block just for extra safety
            // this stream will have been closed by 'attachBinaryFromStream' but we close
            // here too anyway.
            StreamUtil.close(limitedIs);
        }
    }

    /*
     * FYI: Warning: this way of getting content type doesn't work. String mimeType =
     * URLConnection.guessContentTypeFromStream(inputStream);
     * 
     * returns true if it was detected AND saved as an image
     */
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
                if (formatName != null) {
                    formatName = formatName.toLowerCase();
                    reader.setInput(is, true, false);
                    String mimeType = "image/" + formatName;
                    BufferedImage bufImg = reader.read(0);
                    ByteArrayOutputStream os = new ByteArrayOutputStream();
                    ImageIO.write(bufImg, formatName, os);
                    byte[] bytes = os.toByteArray();
                    is2 = new LimitedInputStreamEx(new ByteArrayInputStream(bytes), maxFileSize);
                    attachBinaryFromStream(ms, false, attKey, null, nodeId, sourceUrl, bytes.length, is2, mimeType,
                            bufImg.getWidth(null), bufImg.getHeight(null), false, true, true, storeLocally, sourceUrl,
                            false, null);
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

    public void writeStream(MongoSession ms, boolean importMode, String attName, SubNode node,
            LimitedInputStreamEx stream, String fileName, String mimeType, SubNode userNode) {
        // don't create attachment here, there shuold already be one, but we pass create=true anyway
        Attachment att = node.getAttachment(attName, !importMode, false);
        auth.ownerAuth(node);
        DBObject metaData = new BasicDBObject();
        metaData.put("nodeId", node.getId());
        if (userNode == null) {
            userNode = read.getAccountByUserName(null, null, false);
        }
        // if we're importing we should leave any binary alone
        if (!importMode) {
            // Delete any existing grid data stored under this node, before saving new attachment
            deleteBinary(ms, attName, node, userNode, true);
        }
        String id = grid.store(stream, fileName, mimeType, metaData).toString();
        long streamCount = stream.getCount();
        // update the user quota which enforces their total storage limit
        if (!ms.isAdmin()) {
            user.addBytesToUserNodeBytes(ms, streamCount, userNode);
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
    public void deleteBinary(MongoSession ms, String attName, SubNode node, SubNode userNode, boolean gridOnly) {
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
        if (!ms.isAdmin()) {
            long totalBytes = attach.getTotalAttachmentBytes(ms, node);
            user.addBytesToUserNodeBytes(ms, -totalBytes, userNode);
        }
        Criteria crit = Criteria.where("_id").is(att.getBin());
        crit = auth.addWriteSecurity(ms, crit);
        grid.delete(new Query(crit));
    }

    public InputStream getStream(MongoSession ms, String attName, SubNode node, boolean allowAuth) {
        if (allowAuth) {
            auth.auth(ms, node, PrivilegeType.READ);
        }
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
        /* why not an import here? */
        com.mongodb.client.gridfs.model.GridFSFile gridFile =
                grid.findOne(new Query(Criteria.where("_id").is(att.getBin())));

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
        return arun.run(as -> {
            int count = 0;
            GridFSFindIterable files = grid.find(new Query());
            // Scan all files in the grid
            if (files != null) {
                // I am needing this quick and didn't find another way to do this other than brute force scan.
                // Maybe
                // they are using a linked list so that there genuinely is no faster way ?
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

            GridFSFindIterable files = grid.find(new Query());
            // Scan all files in the grid
            if (files != null) {
                for (GridFSFile file : files) {
                    Document meta = file.getMetadata();
                    if (meta != null) {
                        // Get which nodeId owns this grid file
                        ObjectId id = (ObjectId) meta.get("nodeId");
                        if (id != null) {
                            SubNode node = read.getNode(as, id);
                            // If the node doesn't exist then this grid file is an orphan and should go away
                            if (node == null) {
                                log.debug("Grid Orphan Delete: " + id.toHexString());
                                // Query query = new Query(GridFsCriteria.where("_id").is(file.getId());

                                Query q = new Query(Criteria.where("_id").is(file.getId()));
                                // Note: It's not a bug that we don't call this here:
                                // usrMgr.addNodeBytesToUserNodeBytes(session, node, null, -1);
                                // Because all the userstats are updated at the end of this scan.
                                grid.delete(q);
                                delCount++;
                            }
                            // else update the UserStats by adding the file length to the total for this user
                            else {
                                UserStats stats = statsMap.get(node.getOwner());
                                if (stats == null) {
                                    stats = new UserStats();
                                    stats.binUsage = file.getLength();
                                    statsMap.put(node.getOwner(), stats);
                                } else {
                                    stats.binUsage = stats.binUsage.longValue() + file.getLength();
                                }
                            }
                        }
                    }
                }
            }

            Iterable<SubNode> accntNodes = read.getAccountNodes(as, null, null, null, -1);
            // scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
            // amount).
            for (SubNode accntNode : accntNodes) {
                log.debug("Processing Account Node: id=" + accntNode.getIdStr());
                UserStats stats = statsMap.get(accntNode.getOwner());
                if (stats == null) {
                    stats = new UserStats();
                    stats.binUsage = 0L;
                    statsMap.put(accntNode.getOwner(), stats);
                }
            }
            log.debug(String.valueOf(delCount) + " grid orphans deleted.");
            return null;
        });
    }

    /*
     * An alternative way to get the binary attachment from a node allowing more friendly url format
     * (named nodes). Note, currently this is the format we use for generated ActivityPub objects.
     */
    public void getAttachment(String nameOnAdminNode, String nameOnUserNode, String userName, String id,
            String download, String gid, String attName, HttpServletRequest req, HttpServletResponse response) {
        try {
            if (StringUtils.isEmpty(attName)) {
                attName = Constant.ATTACHMENT_PRIMARY.s();
            }
            // NOTE: Don't check token here, because we need this to be accessible by foreign fediverse
            // servers,
            // but check below only after knowing whether the node has any sharing on it at all or not.
            //
            // Node Names are identified using a colon in front of it, to make it detectable
            if (!StringUtils.isEmpty(nameOnUserNode) && !StringUtils.isEmpty(userName)) {
                id = ":" + userName + ":" + nameOnUserNode;
            } //
            else if (!StringUtils.isEmpty(nameOnAdminNode)) {
                id = ":" + nameOnAdminNode;
            }
            if (id != null) {
                String _id = id;
                String _attName = attName;
                arun.run(as -> {
                    // we don't check ownership of node at this time, but merely check sanity of
                    // whether this ID is even existing or not.
                    SubNode node = read.getNode(as, _id);
                    if (node == null) {
                        throw new RuntimeException("Node not found.");
                    }
                    /*
                     * if there's no sharing at all on the node, then we do the token check, otherwise we allow access.
                     * This is for good fediverse interoperability but still with a level of privacy for completely
                     * unshared nodes.
                     */
                    if (node.getAc() == null || node.getAc().size() == 0) {
                        user.authBearer();
                        crypto.authSig();
                    }
                    String _gid = gid;
                    // if no cachebuster gid was on url then redirect to a url that does have the gid
                    if (_gid == null) {
                        Attachment att = node.getAttachment(_attName, false, false);
                        _gid = null;
                        if (_gid == null) {
                            _gid = att != null ? att.getBin() : null;
                        }
                        if (_gid != null) {
                            try {
                                response.sendRedirect(Util.getFullURL(req, "gid=" + _gid));
                            } catch (Exception e) {
                                throw new RuntimeException("fail.");
                            }
                        }
                    }
                    if (_gid == null) {
                        throw new RuntimeException("No attachment data for node.");
                    }

                    attach.getBinary(as, _attName, node, null, null, download != null, response);
                    return null;
                });
            }
        } catch (Exception e) {
            // need to add some kind of message to exception to indicate to user something
            // with the arguments went wrong.
            ExUtil.error(log, "exception in call processor", e);
        }
    }

    /*
     * binId param not uses currently but the client will send either the gridId of the node depending
     * on which type of attachment it sees on the node
     */
    public void getBinary(String binId, String nodeId, String token, String download, HttpSession session,
            HttpServletResponse response) {
        if (token == null) {
            // Check if this is an 'avatar' request and if so bypass security
            if ("avatar".equals(binId)) {
                arun.run(as -> {
                    attach.getBinary(as, Constant.ATTACHMENT_PRIMARY.s(), null, nodeId, binId, download != null,
                            response);
                    return null;
                });
            } //
            else if ("profileHeader".equals(binId)) { // Check if this is an 'profileHeader Image' request
                // and if so bypass security
                arun.run(as -> {
                    attach.getBinary(as, Constant.ATTACHMENT_HEADER.s(), null, nodeId, binId, download != null,
                            response);
                    return null;
                });
            }
            // Else if not an avatar request then do a secure acccess
            else {
                callProc.run("bin", false, false, null, session, ms -> {
                    attach.getBinary(null, null, null, nodeId, binId, download != null, response);
                    return null;
                });
            }
        } else {
            if (user.validToken(token, null)) {
                arun.run(as -> {
                    attach.getBinary(as, null, null, nodeId, binId, download != null, response);
                    return null;
                });
            }
        }
    }

    // Removes all attachments from 'node' that are not on 'newAttrs'
    public void removeDeletedAttachments(MongoSession ms, SubNode node, HashMap<String, Attachment> newAtts) {
        if (node.getAttachments() == null)
            return;
        // we need toDelete as separate list to avoid "concurrent modification exception" by deleting
        // from the attachments set during iterating it.
        List<String> toDel = new LinkedList<>();
        node.getAttachments().forEach((key, att) -> {
            if (newAtts == null || !newAtts.containsKey(key)) {
                toDel.add(key);
            }
        });
        // run these actual deletes in a separate async thread
        arun.run(as -> {
            for (String key : toDel) {
                attach.deleteBinary(ms, key, node, null, false);
            }
            return null;
        });
    }

    public long getTotalAttachmentBytes(MongoSession ms, SubNode node) {
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

    public PasteAttachmentsResponse pasteAttachments(MongoSession ms, PasteAttachmentsRequest req) {
        PasteAttachmentsResponse res = new PasteAttachmentsResponse();
        SubNode sourceNode = read.getNode(ms, req.getSourceNodeId());
        if (sourceNode == null) {
            throw new RuntimeEx("source node not found");
        }

        SubNode targetNode = read.getNode(ms, req.getTargetNodeId());
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

        update.save(ms, targetNode);
        update.save(ms, sourceNode);

        NodeInfo newNodeInfo = convert.toNodeInfo(false, ThreadLocals.getSC(), ms, targetNode, false,
                Convert.LOGICAL_ORDINAL_GENERATE, false, false, false, true);
        if (newNodeInfo != null) {
            res.setTargetNode(newNodeInfo);
        }

        List<String> sigDirtyNodes = new LinkedList<>();
        sigDirtyNodes.add(targetNode.getIdStr());
        sigDirtyNodes.add(sourceNode.getIdStr());
        return res;
    }
}
