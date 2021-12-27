package quanta.service;

import static quanta.util.Util.ok;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.InsertBookRequest;
import quanta.response.InsertBookResponse;
import quanta.util.ExUtil;
import quanta.util.ImportWarAndPeace;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Special-purpose code for importing the book War and Peace which ships with SubNode, and is used
 * for demonstration purposes to show how browsing, searching, etc. works, and for testing with a
 * reasonable sized chunk of data (i.e. the entire book)
 */
@Component
public class ImportBookService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(ImportBookService.class);

	@Autowired
	private ApplicationContext context;

	@PostConstruct
	public void postConstruct() {
		importBookService = this;
	}

	public InsertBookResponse insertBook(MongoSession ms, InsertBookRequest req) {
		InsertBookResponse res = new InsertBookResponse();
		ms = ThreadLocals.ensure(ms);
		if (!ThreadLocals.getSC().isAdmin() && !ThreadLocals.getSC().isTestAccount()) {
			throw ExUtil.wrapEx("insertBook is an admin-only feature.");
		}

		String nodeId = req.getNodeId();
		SubNode node = read.getNode(ms, nodeId);
		auth.ownerAuthByThread(node);
		log.debug("Insert Root: " + XString.prettyPrint(node));

		/*
		 * for now we don't check book name. Only one book exists: War and Peace
		 */
		ImportWarAndPeace iwap = context.getBean(ImportWarAndPeace.class);
		iwap.importBook(ms, "classpath:public/data/war-and-peace.txt", node,
				safeBooleanVal(req.getTruncated()) ? 2 : Integer.MAX_VALUE);

		update.saveSession(ms);
		res.setSuccess(true);
		return res;
	}

	public static boolean safeBooleanVal(Boolean val) {
		return ok(val) && val.booleanValue();
	}
}
