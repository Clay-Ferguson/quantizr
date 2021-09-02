package org.subnode.util;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.config.SessionContext;
import org.subnode.response.base.ResponseBase;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

/**
 * Thread Local Storage
 * 
 * All thread locals are stored in this class.
 * 
 * Note: We opt for ThreadLocals instead of a Spring Bean with Request scope, so that we can
 * decouple from Web Requests, and have these variables available on a *any* thread even if it's a
 * worker or deamon thread that isn't an actual Web Request.
 */
public class ThreadLocals {
	private static final Logger log = LoggerFactory.getLogger(ThreadLocal.class);

	private static final ThreadLocal<HttpServletResponse> servletResponse = new ThreadLocal<>();
	private static final ThreadLocal<HttpSession> httpSession = new ThreadLocal<>();
	private static final ThreadLocal<SessionContext> sessionContext = new ThreadLocal<>();
	private static final ThreadLocal<ResponseBase> response = new ThreadLocal<>();
	private static final ThreadLocal<Long> stopwatchTime = new ThreadLocal<>();

	private static final ThreadLocal<MongoSession> session = new ThreadLocal<>();

	/*
	 * dirtyNodes is where we accumulate the set of nodes that will all be updated after processing is
	 * done using the api.sessionSave() call. This is a way to not have to worry about doing SAVES on
	 * every object that is touched during the processing of a thread/request.
	 */
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<HashMap<ObjectId, SubNode>>();

	private static final ThreadLocal<LinkedHashMap<String, SubNode>> cachedNodes =
			new ThreadLocal<LinkedHashMap<String, SubNode>>();

	private static int MAX_CACHE_SIZE = 50;

	/*
	 * todo-2: This is to allow our ExportJsonService.resetNode importer to work. This is importing
	 * nodes that should be all self contained as an acyclical-directed graph (i.e. tree) and there's no
	 * risk of nodes without parents, but they MAY be out of order so that the children of some nodes
	 * may appear in the JSON being imported BEFORE their parents (which would cause the parent check to
	 * fail, up until the full node graph has been imported), and so I'm creating this hack to globally
	 * disable the check during the import only.
	 */
	private static final ThreadLocal<Boolean> parentCheckEnabled = new ThreadLocal<>();

	public static void removeAll() {
		httpSession.remove();
		sessionContext.remove();
		servletResponse.remove();
		response.remove();
		stopwatchTime.remove();

		getDirtyNodes().clear();
		getCachedNodes().clear();
		setParentCheckEnabled(true);
		session.remove();
	}

	// todo-0: need to add new mongo-specific props too!
	public static ThreadLocalsContext getContext() {
		// log.debug("getting context from thread: " + Thread.currentThread().getName());
		ThreadLocalsContext ctx = new ThreadLocalsContext();
		ctx.threadId = Thread.currentThread().getId();
		ctx.httpSession = getHttpSession();
		ctx.servletResponse = getServletResponse();
		ctx.sessionContext = getSC();
		ctx.response = getResponse();
		ctx.session = getMongoSession();
		ctx.dirtyNodes = getDirtyNodes();
		ctx.cachedNodes = getCachedNodes();
		ctx.parentCheckEnabled = getParentCheckEnabled();
		return ctx;
	}

	public static void setContext(ThreadLocalsContext ctx) {
		// log.debug("setting context into thread: " + Thread.currentThread().getName());
		setHttpSession(ctx.httpSession);
		setServletResponse(ctx.servletResponse);
		setSC(ctx.sessionContext);
		setResponse(ctx.response);
		setMongoSession(ctx.session);
		setDirtyNodes(ctx.dirtyNodes);
		setCachedNodes(ctx.cachedNodes);
		setParentCheckEnabled(ctx.parentCheckEnabled);
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

	public static SessionContext getSC() {
		return sessionContext.get();
	}

	public static void setServletResponse(HttpServletResponse res) {
		servletResponse.set(res);
	}

	public static HttpServletResponse getServletResponse() {
		return servletResponse.get();
	}

	public static void setResponse(ResponseBase res) {
		response.set(res);
	}

	public static ResponseBase getResponse() {
		return response.get();
	}

	public static void setStopwatchTime(Long val) {
		stopwatchTime.set(val);
	}

	public static Long getStopwatchTime() {
		if (stopwatchTime.get() == null)
			return -1L;
		return stopwatchTime.get();
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
		getDirtyNodes().clear();
	}

	public static void clearCachedNodes() {
		getCachedNodes().clear();
	}

	public static HashMap<ObjectId, SubNode> getDirtyNodes() {
		if (dirtyNodes.get() == null) {
			dirtyNodes.set(new HashMap<ObjectId, SubNode>());
		}
		return dirtyNodes.get();
	}

	public static void setDirtyNodes(HashMap<ObjectId, SubNode> dn) {
		dirtyNodes.set(dn);
	}

	public static void setCachedNodes(LinkedHashMap<String, SubNode> cn) {
		cachedNodes.set(cn);
	}

	private static LinkedHashMap<String, SubNode> getCachedNodes() {
		if (cachedNodes.get() == null) {
			LinkedHashMap<String, SubNode> cn = new LinkedHashMap<String, SubNode>(MAX_CACHE_SIZE + 1, .75F, false) {
				protected boolean removeEldestEntry(Map.Entry<String, SubNode> eldest) {
					return size() > MAX_CACHE_SIZE;
				}
			};
			cachedNodes.set(cn);
		}
		return cachedNodes.get();
	}

	public static boolean hasDirtyNodes() {
		return getDirtyNodes().size() > 0;
	}

	public static void dumpDirtyNodes() {
		if (getDirtyNodes().size() == 0) {
			log.debug("No dirty nodes.");
			return;
		}

		log.debug("Dirty Nodes...");
		getDirtyNodes().forEach((key, value) -> {
			log.debug("    " + key.toHexString());
		});
	}

	/*
	 * Sets 'node' to dirty thus guaranteeing any changes made to it, even if made later on in the
	 * request, are guaranteed to be written out
	 */
	public static void dirty(SubNode node) {
		if (node.getId() == null) {
			return;
		}

		SubNode nodeFound = getDirtyNodes().get(node.getId());

		/*
		 * If we are setting this node to dirty, but we already see another copy of the same nodeId in
		 * memory, this is a problem and will mean whichever node happens to be saved 'last' will overwrite,
		 * so this *may* result in data loss.
		 * 
		 * todo-1: Should we find a way to be sure this never happens? This is basically another way of
		 * saying with non-ACID databases transactions don't really 'work'
		 */
		if (nodeFound != null && nodeFound.hashCode() != node.hashCode()) {
			log.debug(
					"*************** WARNING: multiple instances of objectId " + node.getId().toHexString() + " are in memory.");
			return;
		}

		getDirtyNodes().put(node.getId(), node);
	}

	/* Opposite of dirty */
	public static void clean(SubNode node) {
		// log.debug("Removing from Dirty: " + node.getId().toHexString());
		getDirtyNodes().remove(node.getId());
	}

	public static void cacheNode(String key, SubNode node) {
		getCachedNodes().put(key, node);
		cacheNode(node);
	}

	public static void cacheNode(SubNode node) {
		if (node == null)
			return;

		if (node.getPath() != null) {
			getCachedNodes().put(node.getPath(), node);
		}
		if (node.getId() != null) {
			getCachedNodes().put(node.getId().toHexString(), node);
		}
	}

	public static SubNode getCachedNode(String key) {
		if (StringUtils.isEmpty(key))
			return null;
		return getCachedNodes().get(key);
	}

	public static void setMongoSession(MongoSession ms) {
		session.set(ms);
	}

	public static MongoSession ensure(MongoSession ms) {
		return ms != null ? ms : session.get();
	}

	public static MongoSession getMongoSession() {
		return session.get();
	}
}
