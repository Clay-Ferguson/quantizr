package quanta.service;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.mongodb.client.gridfs.model.GridFSFile;
import jakarta.servlet.http.HttpServletResponse;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.mongo.model.SubNode;
import quanta.service.exports.ExportTarService;
import quanta.util.StreamUtil;

/*
 * This service renders a view of a node as an html page with a nav panel on the left and content on
 * the RHS
 */
@Component
public class PublicationService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(PublicationService.class);

    @Autowired
    private GridFsTemplate grid;

    /*
     * Admin-owned nodes get cached, not just in MongoDB, but also directly in memory for fastest
     * possible page loads
     */
    HashMap<String, String> adminCache = new HashMap<String, String>();

    // todo-0: this method needs to be able to send back an HTML error code if something is wrong
    public void getPublication(String id, boolean updateCache, String nameOnAdminNode, String nameOnUserNode,
            String userName, HttpServletResponse response) {
        BufferedInputStream inStream = null;
        BufferedOutputStream outStream = null;
        String lookup = null;

        if (id != null) {
            lookup = id;
        } else if (nameOnAdminNode != null) {
            lookup = ":" + nameOnAdminNode;
        } else if (nameOnUserNode != null) {
            lookup = ":" + userName + ":" + nameOnUserNode;
        } else {
            throw new RuntimeEx("No id or name provided");
        }

        try {
            SubNode node = svc_mongoRead.getNode(lookup);
            /*
             * Note: It doesn't matter if the current owner owns the node or not, and can access, or not because
             * what we care about here is if the node is public or not.
             */
            if (node == null) {
                returnError(response, "Node not found: " + lookup);
                return;
            }

            if (!AclService.isPublic(node)) {
                throw new RuntimeEx("Node is not public: " + lookup);
            }

            Boolean website = node.getBool(NodeProp.WEBSITE);
            if (!website) {
                throw new RuntimeEx("Node is not published as a website: " + lookup);
            }

            String html = updateCache ? null : cacheGet(node);
            if (html == null) {
                log.debug("GENERATING publication for node: " + lookup);
                // We can run as admin, because the filtering is done in the service to access only public nodes.
                html = svc_arun.run(() -> {
                    ExportTarService svc = (ExportTarService) context.getBean(ExportTarService.class);
                    String _html = svc.generatePublication(node.getIdStr());
                    return _html;
                });
                if (html == null)
                    throw new RuntimeEx("Failed to generate publication for node: " + lookup);

                cachePut(node, html);
            } else {
                log.debug("Using cached publication for node: " + lookup);
            }

            if (response != null) {
                response.setContentType("text/html");
                response.setContentLength((int) html.length());
                response.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
                InputStream is = new ByteArrayInputStream(html.getBytes());
                inStream = new BufferedInputStream(is);
                outStream = new BufferedOutputStream(response.getOutputStream());
                IOUtils.copy(inStream, outStream);
                outStream.flush();
            }
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        } finally {
            StreamUtil.close(inStream, outStream);
        }
    }

    private void returnError(HttpServletResponse response, String message) {
        try {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, message);
        } catch (Exception e) {
            throw new RuntimeEx(e);
        }
    }

    private void cachePut(SubNode node, String html) {
        if (html == null) {
            return;
        }
        String prevBinWebsite = node.getStr(NodeProp.BIN_WEBSITE);

        String existingHtml = cacheGet(node);
        if (html.equals(existingHtml)) {
            return;
        }
        DBObject metaData = new BasicDBObject();
        metaData.put("nodeId", node.getIdStr());
        metaData.put("type", "website");
        String binWebsite =
                grid.store(new ByteArrayInputStream(html.getBytes()), "website", "text/html", metaData).toString();
        node.set(NodeProp.BIN_WEBSITE, binWebsite);

        // If we had a previously cached site on this node, delete it.
        if (prevBinWebsite != null) {
            Query q = new Query(Criteria.where("_id").is(prevBinWebsite));
            grid.delete(q);
            adminCache.remove(prevBinWebsite);
        }

        // cache also in memory so this can be served faster, but we still need admin sites cached in
        // MongoDB so they'er pre-rendered just like everything else.
        if (svc_acl.isAdminOwned(node)) {
            html = adminCache.put(binWebsite, html);
        }
        svc_mongoUpdate.save(node);
    }

    private String cacheGet(SubNode node) {
        String binWebsite = node.getStr(NodeProp.BIN_WEBSITE);
        if (binWebsite == null) {
            return null;
        }

        String html = null;
        if (svc_acl.isAdminOwned(node)) {
            html = adminCache.get(binWebsite);
            if (html != null) {
                return html;
            }
        }

        GridFSFile gridFile = grid.findOne(new Query(Criteria.where("_id").is(binWebsite)));
        if (gridFile == null) {
            log.debug("gridfs ID not found");
            return null;
        }
        GridFsResource gridFsResource = grid.getResource(gridFile);
        try {
            html = IOUtils.toString(gridFsResource.getInputStream(), "UTF-8");
            return html;
        } catch (Exception e) {
            throw new RuntimeEx("unable to readStream", e);
        }
    }

    /*
     * Note: just as an effeciency we do call this method when we know the node is being deleted, but
     * other than that we will be letting the orphan cleaner take care of this.
     */
    public void cacheRemove(SubNode node, boolean updateNode) {
        String binWebsite = node.getStr(NodeProp.BIN_WEBSITE);
        if (binWebsite == null) {
            return;
        }
        Query q = new Query(Criteria.where("_id").is(binWebsite));
        grid.delete(q);

        if (updateNode) {
            node.set(NodeProp.BIN_WEBSITE, null);
            svc_mongoUpdate.save(node);
        }
    }
}
