package quanta.service.imports;

import java.io.InputStream;
import java.util.HashMap;
import org.apache.commons.compress.archivers.ArchiveEntry;
import org.apache.commons.io.IOUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.config.ServiceBase;
import quanta.model.client.Attachment;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.val.Val;

public abstract class ImportArchiveBase extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(ImportArchiveBase.class);

    /*
     * This is used to detect if this 'prototype scope' object might have been autowired, and is getting
     * called for a second time which is NOT supported. Each use of this object requires a new instance
     * of it.
     */
    public boolean used;
    public String targetPath;
    public SubNode importRootNode;
    public SubNode curNode;

    public void processFile(ArchiveEntry entry, InputStream zis, ObjectId ownerId) {
        String name = entry.getName();
        int lastSlashIdx = name.lastIndexOf("/");
        String fileName = lastSlashIdx == -1 ? name : name.substring(lastSlashIdx + 1);
        log.trace("Import FILE Entry: " + entry.getName());

        try {
            TL.setParentCheckEnabled(false);
            Val<Boolean> done = new Val<>(false);

            // if this is an attachment on our curNode then import it.
            if (curNode != null && curNode.getAttachments() != null && curNode.getAttachments().containsKey(fileName)) {
                svc_arun.run(() -> {
                    if (importBinary(entry, curNode, zis, fileName)) {
                        done.setVal(true);
                    }
                    return null;
                });
            }

            // if we processed the above as an attachment we're done bail out.
            if (done.getVal())
                return;

            // HTML FILE
            if (svc_mimeUtil.isHtmlTypeFileName(fileName)) {
            }
            // we ignore the html files during import. Data will be in JSON files
            else
            // JSON FILE
            if (svc_mimeUtil.isJsonFileType(fileName)) {
                log.debug("  isJSON: " + fileName);
                String json = IOUtils.toString(zis, "UTF-8");

                // run unmarshalling as admin (otherwise setPath can bark about user being not same as owner)
                SubNode node = (SubNode) svc_arun.run(() -> {
                    try {
                        SubNode n = Util.simpleMapper.readValue(json, SubNode.class);

                        // this may not be necessary but we definitely don't want this node cached now
                        // with it's currently undetermined id.
                        TL.clean(n);

                        if (svc_mongoRead.nodeExists(n.getId())) {
                            log.debug("IMPORT NODE EXISTED (using new ID): " + n.getIdStr());
                            n.setId(null);
                        }

                        String newPath = svc_mongoUtil.findAvailablePath(targetPath + n.getPath());
                        n.setPath(newPath);
                        // verifyParentPath=false signals to MongoListener to not waste cycles checking the path on this
                        // to verify the parent exists upon saving, because we know the path is fine correct.
                        n.verifyParentPath = false;
                        n.setOwner(ownerId);
                        // log.debug("IMPORT NODE: " + XString.prettyPrint(n));
                        return n;
                    } catch (Exception e) {
                        log.error("Failed unmarshalling node: " + json);
                        return null;
                    }
                });
                if (node == null) {
                    throw new RuntimeException("import unmarshalling failed.");
                }
                curNode = node;
                /*
                 * when importing we want to keep all the attachment info EXCEPT the binary IDs because those will
                 * be changing and obsolete for the imported data, will be reassigned. Nullifying those makes sure
                 * the obsolete values cannot be reused.
                 */
                if (node.getAttachments() != null) {
                    node.getAttachments().forEach((String key, Attachment att) -> {
                        att.setBin(null);
                    });
                }
                
                int tries = 0;
                String nodeName = node.getName();
                String baseNodeName = nodeName;
                SubNode nodeFound = svc_mongoRead.getNodeByNameAP(nodeName, null);
                while (nodeFound != null && ++tries < 50) {
                    nodeName = baseNodeName + "-" + tries;
                    nodeFound = svc_mongoRead.getNodeByNameAP(nodeName, null);
                }
                if (nodeFound != null) {
                    throw new RuntimeException(
                            "Failed to save node " + node.getIdStr() + ". Name already exists: " + nodeName);
                }
                node.setName(nodeName);
                svc_mongoUpdate.save(node);
            }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        } finally {
            TL.setParentCheckEnabled(true);
        }
    }

    /*
     * This method assumes node has already been loaded which means as we process the zip stream we're
     * expecting the JSON for the node to be encountered before any of the attachments.
     *
     * Returns true only if we imported a file.
     */
    public boolean importBinary(ArchiveEntry entry, SubNode node, InputStream zis, String attName) {
        HashMap<String, Attachment> atts = node.getAttachments();
        if (atts == null)
            return false;
        // note the filename in the imported JAR is the 'attName', but when we import we name the
        // Attachment.name back to what it originally was before the export which is in the JSON, but also
        // on the node we have now.
        Attachment att = atts.get(attName);
        if (att == null) {
            return false;
        }
        Long length = att.getSize();
        String mimeType = att.getMime();
        String fileName = att.getFileName();
        LimitedInputStreamEx lzis = new LimitedInputStreamEx(zis, Integer.MAX_VALUE);
        svc_attach.attachBinaryFromStream(true, attName, node, null, fileName, length, lzis, mimeType, -1, -1,
                false, true, false, true, null, false, null);
        return true;
    }
}
