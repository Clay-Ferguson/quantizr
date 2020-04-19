package org.subnode.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.InsertBookRequest;
import org.subnode.response.InsertBookResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.ImportWarAndPeace;
import org.subnode.util.ThreadLocals;
import org.subnode.util.VarUtil;
import org.subnode.util.XString;

/**
 * Special-purpose code for importing the book War and Peace which ships with SubNode, and is used
 * for demonstration purposes to show how browsing, searching, etc. works, and for testing with a
 * reasonable sized chunk of data (i.e. the entire book)
 */
@Component
public class ImportBookService {
	private static final Logger log = LoggerFactory.getLogger(ImportBookService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private SessionContext sessionContext;

	public InsertBookResponse insertBook(MongoSession session, InsertBookRequest req) {
		InsertBookResponse res = new InsertBookResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		if (!sessionContext.isAdmin() && !sessionContext.isTestAccount()) {
			throw ExUtil.wrapEx("insertBook is an admin-only feature.");
		}

		String nodeId = req.getNodeId();
		SubNode node = api.getNode(session, nodeId);
		log.debug("Insert Root: " + XString.prettyPrint(node));

		/*
		 * for now we don't check book name. Only one book exists: War and Peace
		 */
		ImportWarAndPeace iwap = SpringContextUtil.getApplicationContext().getBean(ImportWarAndPeace.class);
		iwap.importBook(session, "classpath:war-and-peace.txt", node, VarUtil.safeBooleanVal(req.getTruncated()) ? 2 : Integer.MAX_VALUE);

		api.saveSession(session);
		res.setSuccess(true);
		return res;
	}
}
