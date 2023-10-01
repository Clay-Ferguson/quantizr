package quanta.util;

import java.util.HashMap;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.bson.types.ObjectId;
import quanta.config.SessionContext;
import quanta.instrument.PerfMonEvent;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.base.ResponseBase;

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
    private Boolean saving;
    private PerfMonEvent rootEvent;
    private HashMap<ObjectId, SubNode> dirtyNodes;
    private HashMap<ObjectId, SubNode> cachedNodes;
    private Boolean parentCheckEnabled;

    ThreadLocalsContext() {
        servletResponse = ThreadLocals.getServletResponse();
        httpSession = ThreadLocals.getHttpSession();
        sessionContext = ThreadLocals.getSC();
        response = ThreadLocals.getResponse();
        session = ThreadLocals.getMongoSession();
        reqBearerToken = ThreadLocals.getReqBearerToken();
        reqSig = ThreadLocals.getReqSig();
        saving = ThreadLocals.getSaving();
        rootEvent = ThreadLocals.getRootEvent();
        dirtyNodes = ThreadLocals.getDirtyNodes();
        cachedNodes = ThreadLocals.getCachedNodes();
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
        ThreadLocals.setSaving(saving);
        ThreadLocals.setRootEvent(rootEvent);
        ThreadLocals.setDirtyNodes(dirtyNodes);
        ThreadLocals.setCachedNodes(cachedNodes);
        ThreadLocals.setParentCheckEnabled(parentCheckEnabled);
    }
}
