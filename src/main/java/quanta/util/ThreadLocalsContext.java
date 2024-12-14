package quanta.util;

import java.util.HashMap;
import org.bson.types.ObjectId;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.SessionContext;
import quanta.mongo.model.SubNode;
import quanta.rest.response.base.ResponseBase;

/**
 * Holder for transferring ThreadLocals values from one thread to another.
 */
public class ThreadLocalsContext {
    private HttpServletResponse servletResponse;
    private HttpSession httpSession;
    private SessionContext sessionContext;
    private Boolean hasAdminAuthority;
    private ResponseBase response;
    private String reqBearerToken;
    private HashMap<ObjectId, SubNode> dirtyNodes;
    private Boolean parentCheckEnabled;

    ThreadLocalsContext() {
        servletResponse = TL.getServletResponse();
        httpSession = TL.getHttpSession();
        sessionContext = TL.getSC();
        hasAdminAuthority = TL.getHasAdminAuthority();
        response = TL.getResponse();
        reqBearerToken = TL.getReqBearerToken();
        dirtyNodes = null; // Use thread's own private scope of dirty nodes.
        parentCheckEnabled = TL.getParentCheckEnabled();
    }

    public void setValsIntoThread() {
        TL.setServletResponse(servletResponse);
        TL.setHttpSession(httpSession);
        TL.setSC(sessionContext);
        TL.setHasAdminAuthority(hasAdminAuthority);
        TL.setResponse(response);
        TL.setReqBearerToken(reqBearerToken);
        TL.setDirtyNodes(dirtyNodes);
        TL.setParentCheckEnabled(parentCheckEnabled);
    }
}
