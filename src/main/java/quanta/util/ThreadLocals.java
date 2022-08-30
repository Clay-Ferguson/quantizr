package quanta.util;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.config.SessionContext;
import quanta.instrument.PerfMonEvent;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.base.ResponseBase;

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
	private static final ThreadLocal<MongoSession> session = new ThreadLocal<>();
	private static final ThreadLocal<String> reqBearerToken = new ThreadLocal<>();

	/*
	 * Each thread will set this when a root event is created and any other events that get created,
	 * will be added as top level children under it. Currently we don't do a hierarchy, but just one
	 * level of containment
	 */
	private static final ThreadLocal<PerfMonEvent> rootEvent = new ThreadLocal<>();

	/*
	 * dirtyNodes is where we accumulate the set of nodes that will all be updated after processing is
	 * done using the api.sessionSave() call. This is a way to not have to worry about doing SAVES on
	 * every object that is touched during the processing of a thread/request.
	 */
	private static final ThreadLocal<HashMap<ObjectId, SubNode>> dirtyNodes = new ThreadLocal<>();

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
		reqBearerToken.remove();
		rootEvent.remove();

		getDirtyNodes().clear();
		getCachedNodes().clear();
		setParentCheckEnabled(true);
		session.remove();
	}

	public static void requireAdmin() {
		if (!getSC().isAdmin()) {
			throw ExUtil.wrapEx("admin only function.");
		}
	}

	public static ThreadLocalsContext getContext() {
		// log.debug("getting context from thread: " + Thread.currentThread().getName());
		ThreadLocalsContext ctx = new ThreadLocalsContext();
		ctx.threadId = Thread.currentThread().getId();
		ctx.httpSession = getHttpSession();
		ctx.sessionContext = getSC();
		return ctx;
	}

	public static void setContext(ThreadLocalsContext ctx) {
		// log.debug("setting context into thread: " + Thread.currentThread().getName());
		setHttpSession(ctx.httpSession);
		if (ctx.sessionContext != null) {
			setSC(ctx.sessionContext.cloneForThread());
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
		initMongoSession(sc);
	}

	public static void initMongoSession(SessionContext sc) {
		MongoSession ms = new MongoSession(sc.getUserName(), sc.getUserNodeId());
		setMongoSession(ms);
	}

	/*
	 * todo-1: We need a way to detect when some code has accidentally called this from a deamon thread
	 * where there won't be any session context, rather than letting it result in a NPE that we have to
	 * trace back to this cause.
	 */
	public static SessionContext getSC() {
		return sessionContext.get();
	}

	public static void setServletResponse(HttpServletResponse res) {
		servletResponse.set(res);
	}

	public static HttpServletResponse getServletResponse() {
		return servletResponse.get();
	}

	public static void setRootEvent(PerfMonEvent res) {
		rootEvent.set(res);
	}

	public static PerfMonEvent getRootEvent() {
		return rootEvent.get();
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

	public static void setParentCheckEnabled(Boolean val) {
		parentCheckEnabled.set(val);
	}

	public static Boolean getParentCheckEnabled() {
		if (no(parentCheckEnabled.get()))
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
		if (no(dirtyNodes.get())) {
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

	// Since this cache is thread specific there's no thread-sync mutext required here.
	private static LinkedHashMap<String, SubNode> getCachedNodes() {
		if (no(cachedNodes.get())) {
			// #LRU
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

	public static int getDirtyNodeCount() {
		return getDirtyNodes().size();
	}

	public static boolean hasDirtyNode(ObjectId nodeId) {
		return getDirtyNodes().containsKey(nodeId);
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
	 * request, are guaranteed to be saved to the DB.
	 */
	public static void dirty(SubNode node) {
		if (no(node.getId())) {
			return;
		}

		SubNode nodeFound = getDirtyNodes().get(node.getId());

		/*
		 * If we are setting this node to dirty, but we already see another copy of the same nodeId in
		 * memory, this is a problem and will mean whichever node happens to be saved 'last' will overwrite,
		 * so this *may* result in data loss.
		 * 
		 * Normally NodeIterator.java, and all places we ready from the DB should be wrapped in a way as to
		 * let the dirty nodes be correctly referenced, so this message should never get printed.
		 */
		if (ok(nodeFound) && nodeFound.hashCode() != node.hashCode()) {
			log.debug("WARNING: multiple instances of objectId " + node.getIdStr() + " are in memory.");
			return;
		}

		getDirtyNodes().put(node.getId(), node);
	}

	/* Opposite of dirty */
	public static void clean(SubNode node) {
		// log.debug("Removing from Dirty: " + node.getIdStr());
		getDirtyNodes().remove(node.getId());
	}

	/*
	 * We cache nodes based on various arbitrary key formats, with this method, but we also call
	 * cacheNode on each one too because it's always good to have the path-based and ID-based entries in
	 * the cache too.
	 */
	public static void cacheNode(String key, SubNode node) {
		getCachedNodes().put(key, node);
		cacheNode(node);
	}

	public static void pathChanged(String oldPath, SubNode node) {
		if (StringUtils.isEmpty(oldPath))
			return;
		getCachedNodes().remove(oldPath);
		cacheNode(node);
	}

	public static void cacheNode(SubNode node) {
		if (no(node))
			return;

		LinkedHashMap<String, SubNode> cn = getCachedNodes();
		if (ok(node.getPath())) {
			cn.put(node.getPath(), node);
		}

		if (ok(node.getId())) {
			cn.put(node.getIdStr(), node);
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
		MongoSession ret = ok(ms) ? ms : session.get();

		// this should never happen, but if we didn't have a mongoSession here make one to return
		if (no(ret) && ok(getSC())) {
			ret = new MongoSession(getSC().getUserName(), getSC().getUserNodeId());
		}
		return ret;
	}

	public static MongoSession getMongoSession() {
		return session.get();
	}
}
