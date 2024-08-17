package quanta.util;

import java.util.HashMap;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.mongo.model.SubNode;
import quanta.perf.PerfEvent;
import quanta.rest.response.base.ResponseBase;

/**
 * Thread Local Storage
 *
 * All thread locals are stored in this class.
 *
 * Note: We opt for ThreadLocals instead of a Spring Bean with Request scope, so that we can
 * decouple from Web Requests, and have these variables available on a *any* thread even if it's a
 * worker or deamon thread that isn't an actual Web Request.
 */
public class TL {
    private static Logger log = LoggerFactory.getLogger(TL.class);
    private static final ThreadLocal<HttpServletResponse> servletResponse = new ThreadLocal<>();
    private static final ThreadLocal<HttpServletRequest> servletRequest = new ThreadLocal<>();
    private static final ThreadLocal<HttpSession> httpSession = new ThreadLocal<>();
    private static final ThreadLocal<SessionContext> sessionContext = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> hasAdminAuthority = new ThreadLocal<>();
    private static final ThreadLocal<ResponseBase> response = new ThreadLocal<>();
    private static final ThreadLocal<String> reqBearerToken = new ThreadLocal<>();
    private static final ThreadLocal<String> reqSig = new ThreadLocal<>();

    /*
     * Each thread will set this when a root event is created and any other events that get created,
     * will be added as top level children under it. Currently we don't do a hierarchy, but just one
     * level of containment
     */
    private static final ThreadLocal<PerfEvent> rootEvent = new ThreadLocal<>();

    /*
     * dirtyNodes is where we accumulate the set of nodes that will all be updated after processing is
     * done using the api.sessionSave() call. This is a way to not have to worry about doing SAVES on
     * every object that is touched during the processing of a thread/request.
     */
    private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<>();

    /*
     * This is to allow our ExportJsonService.resetNode importer to work. This is importing nodes that
     * should be all self contained as an acyclical-directed graph (i.e. tree) and there's no risk of
     * nodes without parents, but they MAY be out of order so that the children of some nodes may appear
     * in the JSON being imported BEFORE their parents (which would cause the parent check to fail, up
     * until the full node graph has been imported), and so I'm creating this hack to globally disable
     * the check during the import only.
     */
    private static final ThreadLocal<Boolean> parentCheckEnabled = new ThreadLocal<>();

    static {
        parentCheckEnabled.set(true);
    }

    public static void removeAll() {
        httpSession.remove();
        sessionContext.remove();
        hasAdminAuthority.remove();
        servletResponse.remove();
        servletRequest.remove();
        response.remove();
        reqBearerToken.remove();
        reqSig.remove();
        rootEvent.remove();
        clearDirtyNodes();
        setParentCheckEnabled(true);

    }

    public static void requireAdmin() {
        if (!TL.hasAdminPrivileges()) {
            throw ExUtil.wrapEx("admin only function.");
        }
    }

    public static void requireAdminThread() {
        if (!TL.hasAdminPrivileges()) {
            throw new ForbiddenException();
        }
    }

    public static void setHttpSession(HttpSession session) {
        httpSession.set(session);
    }

    public static HttpSession getHttpSession() {
        return httpSession.get();
    }

    public static void setSC(SessionContext sc) {
        sessionContext.set(sc);
    }

    // Note: This is not the 'general purpose' way to check for full priviliges. Call
    // hasAdminPrivileges instead.
    public static void setHasAdminAuthority(Boolean auth) {
        hasAdminAuthority.set(auth);
    }

    /*
     * We can either be the actual admin SessionContext or else just a node that has been elevated to
     * admin authority to return true here
     */
    public static boolean hasAdminPrivileges() {
        return getSC().isAdmin() || getHasAdminAuthority();
    }

    public static SessionContext getSC() {
        SessionContext sc = sessionContext.get();

        // this has WAY too many false positives. Not sure what to do about this.
        // if (sc == null && ThreadLocals.getServletRequest() == null) {
        // log.warn(
        // "***THIS MAY NOT INDICATE A BUG*** getSC() called in Non-WEB Request Thread!\n\nStack=" +
        // ExUtil.getStackTrace(null)
        // );
        // }
        return sc;
    }

    public static boolean getHasAdminAuthority() {
        return hasAdminAuthority.get() != null && hasAdminAuthority.get().booleanValue();
    }

    public static void setServletResponse(HttpServletResponse res) {
        servletResponse.set(res);
    }

    public static HttpServletResponse getServletResponse() {
        return servletResponse.get();
    }

    public static void setServletRequest(HttpServletRequest req) {
        servletRequest.set(req);
    }

    public static HttpServletRequest getServletRequest() {
        return servletRequest.get();
    }

    public static void setRootEvent(PerfEvent res) {
        rootEvent.set(res);
    }

    public static void setResponse(ResponseBase res) {
        response.set(res);
    }

    public static ResponseBase getResponse() {
        return response.get();
    }

    public static void setReqBearerToken(String token) {
        reqBearerToken.set(token);
    }

    public static String getReqBearerToken() {
        return reqBearerToken.get();
    }

    public static void setReqSig(String sig) {
        reqSig.set(sig);
    }

    public static String getReqSig() {
        return reqSig.get();
    }

    public static void setParentCheckEnabled(Boolean val) {
        parentCheckEnabled.set(val);
    }

    public static Boolean getParentCheckEnabled() {
        if (parentCheckEnabled.get() == null)
            return false;
        return parentCheckEnabled.get();
    }

    public static void clearDirtyNodes() {
        if (getDirtyNodes() != null)
            getDirtyNodes().clear();
    }

    public static HashMap<ObjectId, SubNode> getDirtyNodes() {
        return dirtyNodes.get();
    }

    public static void setDirtyNodes(HashMap<ObjectId, SubNode> dn) {
        dirtyNodes.set(dn);
    }

    public static boolean hasDirtyNodes() {
        return getDirtyNodes() != null && getDirtyNodes().size() > 0;
    }

    public static int getDirtyNodeCount() {
        return getDirtyNodes() == null ? 0 : getDirtyNodes().size();
    }

    public static boolean hasDirtyNode(ObjectId nodeId) {
        return getDirtyNodes() != null && getDirtyNodes().containsKey(nodeId);
    }

    public static void dumpDirtyNodes() {
        if (getDirtyNodes() == null || getDirtyNodes().size() == 0) {
            log.debug("No dirty nodes.");
            return;
        }
        log.debug("Dirty Nodes...");
        getDirtyNodes().forEach((key, value) -> {
            if (!key.toHexString().equals(value.getIdStr())) {
                throw new RuntimeException(
                        "Node originally cached as ID " + key.toHexString() + " now has key" + value.getIdStr());
            }
            log.debug("    " + key.toHexString());
        });
    }

    /*
     * Sets 'node' to dirty thus guaranteeing any changes made to it, even if made later on in the
     * request, are guaranteed to be saved to the DB.
     */
    public static void dirty(SubNode node) {
        if (node == null || node.getId() == null) {
            return;
        }
        if (dirtyNodes.get() == null) {
            dirtyNodes.set(new HashMap<ObjectId, SubNode>());
        }
        SubNode nodeFound = getDirtyNodes().get(node.getId());
        /*
         * If we are setting this node to dirty, but we already see another copy of the same nodeId in
         * memory, this is a problem and will mean whichever node happens to be saved 'last' will overwrite,
         * so this *may* result in data loss.
         */
        if (nodeFound != null) {
            if (nodeFound.hashCode() != node.hashCode()) {
                ExUtil.warn("WARNING: multiple instances of objectId " + node.getIdStr() + " are in memory.");
            }
        }
        getDirtyNodes().put(node.getId(), node);
    }

    // Opposite of dirty
    public static void clean(SubNode node) {
        if (getDirtyNodes() != null)
            getDirtyNodes().remove(node.getId());
    }
}
