package org.subnode.util;

import java.util.HashMap;
import java.util.LinkedHashMap;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.config.SessionContext;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.base.ResponseBase;

/**
 * Holder for transferring ThreadLocals values from one thread to another.
 */
public class ThreadLocalsContext {
	private static final Logger log = LoggerFactory.getLogger(ThreadLocalsContext.class);

	public long threadId;
	public HttpServletResponse servletResponse;
	public HttpSession httpSession;
	public SessionContext sessionContext;
	public ResponseBase response;
	public MongoSession session;
	public HashMap<ObjectId, SubNode> dirtyNodes;
	public LinkedHashMap<String, SubNode> cachedNodes;
	public Boolean parentCheckEnabled;
}
