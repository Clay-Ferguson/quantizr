package org.subnode.test;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import org.apache.commons.io.FileUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.AttachmentService;
import org.subnode.service.UserManagerService;
import org.subnode.util.LimitedInputStreamEx;

@Component("MongoTest")
public class MongoTest implements TestIntf {
	private static final Logger log = LoggerFactory.getLogger(MongoTest.class);

	@Autowired
	private MongoUtil mongoUtil;

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private UserManagerService userManagerService;

	@Override
	public void test() throws Exception {
		log.debug("*****************************************************************************************");
		log.debug("MongoTest Running!");

		authTest();

		// // Verify we can lookup the node we just inserted, by ObjectId
		// SubNode nodeFoundById = read.getNode(adminSession, node.getId());
		// if (nodeFoundById == null) {
		// throw new RuntimeEx("Unable to find node by id.");
		// }

		// // Verify a lookup by hex string
		// SubNode nodeFoundByStrId = read.getNode(adminSession,
		// node.getId().toHexString());
		// if (nodeFoundByStrId == null) {
		// throw new RuntimeEx("Unable to find node by id: " +
		// node.getId().toHexString());
		// }

		// // Set a property on the node and save the node
		// node.setProp("testKeyA", new SubNodePropVal("tesetValA"));
		// update.save(adminSession, node);
		// log.debug("updated first node.");

		// String newGuyName = "newguy";
		// SubNode stuffOwnerNode = util.createUser(adminSession, newGuyName, "",
		// "passy", true);
		// MongoSession session = MongoSession.createFromNode(stuffOwnerNode);

		// // ----------Verify an attempt to write a duplicate 'path' fails
		// boolean uniqueViolationCaught = false;
		// try {
		// SubNode dupNode = create.createNode(adminSession, "/usrx");
		// update.save(adminSession, dupNode);
		// }
		// catch (Exception e) {
		// uniqueViolationCaught = true;
		// }

		// if (!uniqueViolationCaught) {
		// throw new RuntimeEx("Failed to catch unique constraint violation.");
		// }

		// runBinaryTests(adminSession);

		log.debug("Mongo Test Ok.");
		log.debug("*****************************************************************************************");
	}

	public void authTest() {
		MongoSession adminSession = auth.getAdminSession();

		SubNode adminNode = read.getUserNodeByUserName(adminSession, PrincipalName.ADMIN.s());
		if (adminNode == null) {
			throw new RuntimeEx("Unable to find admin user node.");
		}

		// root for all testing
		SubNode testingRoot = create.createNode(adminSession, "/r/?");
		testingRoot.setContent("Root for Testing");
		update.save(adminSession, testingRoot);

		// Insert a test node
		SubNode adminsNode = create.createNode(adminSession, testingRoot.getPath() + "/?");
		adminsNode.setContent("admin's test node " + System.currentTimeMillis());
		update.save(adminSession, adminsNode);
		ObjectId insertedId = adminsNode.getId();
		log.debug("admin inserted a node: " + insertedId.toString());

		// login as adam
		MongoSession adamSession = loginUser("adam");

		// adam tries to set the path on adminsNode
		try {
			adminsNode.setPath(adminsNode.getPath() + "abc");
			update.save(adamSession, adminsNode);
			throw new RuntimeException("failed to block path alter.");
		} catch (NodeAuthFailedException e) {
			log.debug("Successful path alter blocked.");
		}

		// let adam try and fail to access insertedId
		try {
			SubNode updateNode = read.getNode(adamSession, insertedId);
			throw new RuntimeException("failed to block.");
		} catch (NodeAuthFailedException e) {
			log.debug("Successful auth block.");
		}

		// adam attempts and fails to create a node in a protected area
		try {
			log.debug("Insecure root insert test.");
			SubNode adamsNode = create.createNode(adamSession, testingRoot.getPath() + "/?");
			adamsNode.setContent("adam's test node " + System.currentTimeMillis());
			update.save(adminSession, adamsNode);
			throw new RuntimeException("allowed node in secure area");
		} catch (NodeAuthFailedException e) {
			log.debug("successfully blocked invalid create (in root)");
		}

		// adam attempts and fails to create a node under adminsNode
		try {
			log.debug("Insecure insert test (under adminsNode)");
			SubNode adamsNode = create.createNode(adamSession, adminsNode.getPath() + "/?");
			adamsNode.setContent("adam's test node " + System.currentTimeMillis());
			update.save(adminSession, adamsNode);
			throw new RuntimeException("allowed node in secure area");
		} catch (NodeAuthFailedException e) {
			log.debug("successfully blocked invalid create (in an admin node)");
		}

		// adam successfully inserts node in his root
		SubNode adamsNode = null;
		SubNode adamsRootNode = read.getUserNodeByUserName(adamSession, "adam");
		if (adamsRootNode != null) {
			adamsNode = create.createNode(adamSession, adamsRootNode.getPath() + "/?");
			adamsNode.setContent("adam's test node " + System.currentTimeMillis());
			update.save(adamSession, adamsNode);
			insertedId = adamsNode.getId();
			log.debug("adam inserted a node: " + insertedId.toString());
		}

		// admin tries to save a duplicated path
		adamsNode.setPath(adminsNode.getPath());
		try {
			MongoThreadLocal.setMongoSession(adminSession);
			update.save(adminSession, adamsNode);
			throw new RuntimeException("failed to detect keydup.");
		} catch (DuplicateKeyException e) {
			log.debug("Successfully rejected key dup.");
		}

		// adam tries and fails to save adminsNode
		try {
			log.debug("Attempting save by wrong user.");
			MongoThreadLocal.setMongoSession(adamSession);
			update.save(adamSession, adminsNode);
			throw new RuntimeException("failed to block.");
		} catch (NodeAuthFailedException e) {
			log.debug("Successfully blocked save by wrong user.");
		}
	}

	public void testPathRegex() {
		// Direct Children Test
		String dc = mongoUtil.regexDirectChildrenOfPath("/abc");
		verify("/abc/def".matches(dc));
		verify(!"/abc/def/x".matches(dc));
		verify(!"/abcx".matches(dc));

		// Recursive Children Test
		String rc = mongoUtil.regexRecursiveChildrenOfPath("/abc");
		verify("/abc/def".matches(rc));
		verify("/abc/def/x".matches(rc));
		verify("/abc/def/xyz/nop".matches(rc));
		verify(!"/abcx".matches(rc));
	}

	public void verify(boolean val) {
		if (!val) {
			throw new RuntimeException("Assertion failed.");
		}
	}

	public void runBinaryTests(MongoSession session) {
		log.debug("Running binaries tests.");

		try {
			SubNode node = create.createNode(session, "/binaries");
			update.save(session, node);
			int maxFileSize = userManagerService.getMaxUploadSize(session);
			attachmentService.writeStream(session, "", node,
					new LimitedInputStreamEx(new FileInputStream("/home/clay/test-image.png"), maxFileSize), null, "image/png",
					null);
			update.save(session, node);

			log.debug("inserted root for binary testing.", null, "image/png", null);

			InputStream inStream = attachmentService.getStream(session, "", node, true);
			FileUtils.copyInputStreamToFile(inStream, new File("/home/clay/test-image2.png"));
			log.debug("completed reading back the file, and writing out a copy.");
		} catch (Exception e) {
			throw new RuntimeEx(e);
		}
	}

	private MongoSession loginUser(String userName) {
		// code is obsolete now.
		// MongoSession session = auth.processCredentials(userName, appProp.getTestPassword(), null);
		// MongoThreadLocal.setMongoSession(session);
		// return session;
		return null;
	}
}
