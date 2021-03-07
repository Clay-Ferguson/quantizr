package org.subnode.test;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.AttachmentService;
import org.subnode.util.LimitedInputStreamEx;

@Component("MongoTest")
public class MongoTest implements TestIntf {
	private static final Logger log = LoggerFactory.getLogger(MongoTest.class);

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoDelete delete;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private AttachmentService attachmentService;

	@Override
    public void test() throws Exception {
		log.debug("*****************************************************************************************");
		log.debug("MongoTest Running!");

		MongoSession adminSession = auth.getAdminSession();

		SubNode adminNode = read.getUserNodeByUserName(adminSession, PrincipalName.ADMIN.s());
		if (adminNode == null) {
			throw new RuntimeEx("Unable to find admin user node.");
		}

		// Insert a test node
		// SubNode node = create.createNode(adminSession, "/usrx");
		// node.setProp("testKey", new SubNodePropVal("testVal"));
		// update.save(adminSession, node);
		// log.debug("inserted first node.");

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

	public void runBinaryTests(MongoSession session) {
		log.debug("Running binaries tests.");

		try {
			SubNode node = create.createNode(session, "/binaries");
			update.save(session, node);
			int maxFileSize = session.getMaxUploadSize();
			attachmentService.writeStream(session, "", node,
					new LimitedInputStreamEx(new FileInputStream("/home/clay/test-image.png"), maxFileSize), null,
					"image/png", null);
			update.save(session, node);

			log.debug("inserted root for binary testing.", null, "image/png", null);

			InputStream inStream = attachmentService.getStream(session, "", node, true);
			FileUtils.copyInputStreamToFile(inStream, new File("/home/clay/test-image2.png"));
			log.debug("completed reading back the file, and writing out a copy.");
		} catch (Exception e) {
			throw new RuntimeEx(e);
		}
	}
}
