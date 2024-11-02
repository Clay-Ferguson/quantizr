package quanta.service;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import jakarta.servlet.http.HttpServletResponse;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
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

    // @Autowired
    // private GridFsTemplate grid;

    HashMap<String, String> cache = new HashMap<String, String>();

    // todo-0: this method needs to be able to send back an HTML error code of something is wrong
    public void getPublication(String id, String nameOnAdminNode, String nameOnUserNode, String userName,
            HttpServletResponse response) {
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
            // todo-0: run test proving if user revokes the public sharing then the publication is no longer
            // available
            SubNode node = svc_mongoRead.getNode(lookup);

            /*
             * Note: It doesn't matter if the current owner owns the node or not, and can access, or not because
             * what we care about here is if the node is public or not.
             */
            if (node == null)
                throw new RuntimeEx("Node not found: " + lookup);

            if (!AclService.isPublic(node)) {
                cache.remove(lookup);
                throw new RuntimeEx("Node is not public: " + lookup);
            }

            String html = cache.get(lookup);
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

                // todo-0: sharing dialog needs a button to "Publish" which basically removes the item from the
                // cache so it will regenerate as needed.
                // todo-0: Also without that sharing option in place we want to also in that case make the HTML not
                // be accessible.
                cache.put(lookup, html);
            } else {
                log.debug("Using cached publication for node: " + lookup);
            }

            response.setContentType("text/html");
            response.setContentLength((int) html.length());
            response.setHeader("Cache-Control", "public, max-age=86400"); // 1 day

            InputStream is = new ByteArrayInputStream(html.getBytes());
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
}
