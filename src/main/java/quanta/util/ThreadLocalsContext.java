package quanta.util;

import java.util.HashMap;
import org.bson.types.ObjectId;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import quanta.config.SessionContext;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.rest.response.base.ResponseBase;

/**
 * Holder for transferring ThreadLocals values from one thread to another.
 */
public class ThreadLocalsContext {
    private HttpServletResponse servletResponse;
    private HttpSession httpSession;
    private SessionContext sessionContext;
    private ResponseBase response;
    private MongoSession session;
    private String reqBearerToken;
    private String reqSig;
    private HashMap<ObjectId, SubNode> dirtyNodes;
    private Boolean parentCheckEnabled;

    ThreadLocalsContext() {
        servletResponse = ThreadLocals.getServletResponse();
        httpSession = ThreadLocals.getHttpSession();
        sessionContext = ThreadLocals.getSC();
        response = ThreadLocals.getResponse();
        session = ThreadLocals.getMongoSession();
        reqBearerToken = ThreadLocals.getReqBearerToken();
        reqSig = ThreadLocals.getReqSig();
        dirtyNodes = null; // Use thread's own private scope of dirty nodes.
        parentCheckEnabled = ThreadLocals.getParentCheckEnabled();
    }

    public void setValsIntoThread() {
        ThreadLocals.setServletResponse(servletResponse);
        ThreadLocals.setHttpSession(httpSession);
        ThreadLocals.setSC(sessionContext);
        ThreadLocals.setResponse(response);
        ThreadLocals.setMongoSession(session);
        ThreadLocals.setReqBearerToken(reqBearerToken);
        ThreadLocals.setReqSig(reqSig);
        ThreadLocals.setDirtyNodes(dirtyNodes);
        ThreadLocals.setParentCheckEnabled(parentCheckEnabled);
    }
}
