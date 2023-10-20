package quanta.test;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import org.apache.commons.io.FileUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import quanta.actpub.model.APList;
import quanta.actpub.model.APObj;
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.exception.base.RuntimeEx;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.LimitedInputStreamEx;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * This is actually where I just run various experiments related to MongoDB, and this is not
 * supposed to be any thing like a unit test for the mongo stuff.
 */
@Component("MongoTestService")
public class MongoTestService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoTestService.class);

    public void test() throws Exception {
        log.debug("MongoTest Running!");
        // testComplexProperties();
        // testDirtyReads();
        // testPathRegex();
        // authTest();
        // // Verify we can lookup the node we just inserted, by ObjectId
        // SubNode nodeFoundById = read.getNode(adminSession, node.getId());
        // if (no(nodeFoundById )) {
        // throw new RuntimeEx("Unable to find node by id.");
        // }
        // // Verify a lookup by hex string
        // SubNode nodeFoundByStrId = read.getNode(adminSession,
        // node.getIdStr());
        // if (no(nodeFoundByStrId )) {
        // throw new RuntimeEx("Unable to find node by id: " +
        // node.getIdStr());
        // }
        // // Set a property on the node and save the node
        // node.setProp("testKeyA", "tesetValA");
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
    }

    public void authTest() {
        MongoSession as = asUser(PrincipalName.ADMIN.s());
        SubNode adminNode = read.getAccountByUserName(as, PrincipalName.ADMIN.s(), true);
        if (adminNode == null) {
            throw new RuntimeEx("Unable to find admin user node.");
        }
        // root for all testing
        SubNode testingRoot = create.createNode(as, "/r/?");
        testingRoot.setContent("Root for Testing");
        update.save(as, testingRoot);
        // Insert a test node
        SubNode adminsNode = create.createNode(as, testingRoot.getPath() + "/?");
        adminsNode.setContent("admin's test node " + System.currentTimeMillis());
        update.save(as, adminsNode);
        ObjectId insertedId = adminsNode.getId();
        log.debug("admin inserted a node: " + insertedId.toString());
        // login as adam
        MongoSession adamSession = asUser("adam");
        // adam tries to set the path on adminsNode
        try {
            adminsNode.setPath(adminsNode.getPath() + "abc");
            update.save(adamSession, adminsNode);
            throw new RuntimeException("failed to block path alter.");
        } catch (ForbiddenException e) {
            log.debug("Successful path alter blocked.");
        }
        // let adam try and fail to access insertedId
        try {
            SubNode updateNode = read.getNode(adamSession, insertedId);
            throw new RuntimeException("failed to block.");
        } catch (ForbiddenException e) {
            log.debug("Successful auth block.");
        }
        // adam attempts and fails to create a node in a protected area
        try {
            log.debug("Insecure root insert test.");
            SubNode adamsNode = create.createNode(adamSession, testingRoot.getPath() + "/?");
            adamsNode.setContent("adam's test node " + System.currentTimeMillis());
            update.save(as, adamsNode);
            throw new RuntimeException("allowed node in secure area");
        } catch (ForbiddenException e) {
            log.debug("successfully blocked invalid create (in root)");
        }
        // adam attempts and fails to create a node under adminsNode
        try {
            log.debug("Insecure insert test (under adminsNode)");
            SubNode adamsNode = create.createNode(adamSession, adminsNode.getPath() + "/?");
            adamsNode.setContent("adam's test node " + System.currentTimeMillis());
            update.save(as, adamsNode);
            throw new RuntimeException("allowed node in secure area");
        } catch (ForbiddenException e) {
            log.debug("successfully blocked invalid create (in an admin node)");
        }
        // adam successfully inserts node in his root
        SubNode adamsNode = null;
        SubNode adamsRootNode = read.getAccountByUserName(adamSession, "adam", false);
        if (adamsRootNode != null) {
            adamsNode = create.createNode(adamSession, adamsRootNode.getPath() + "/?");
            adamsNode.setContent("adam's test node " + System.currentTimeMillis());
            update.save(adamSession, adamsNode);
            insertedId = adamsNode.getId();
            log.debug("adam inserted a node: " + insertedId.toString());
        }
        // admin tries to save a duplicated path
        asSession(as);
        adamsNode.setPath(adminsNode.getPath());
        try {
            ThreadLocals.setMongoSession(as);
            update.save(as, adamsNode);
            throw new RuntimeException("failed to detect keydup.");
        } catch (DuplicateKeyException e) {
            log.debug("Successfully rejected key dup.");
        }
        // adam tries and fails to save adminsNode
        asSession(adamSession);
        try {
            log.debug("Attempting save by wrong user.");
            ThreadLocals.setMongoSession(adamSession);
            update.save(adamSession, adminsNode);
            throw new RuntimeException("failed to block.");
        } catch (ForbiddenException e) {
            log.debug("Successfully blocked save by wrong user.");
        }
    }

    public void testPathRegex() {
        // Direct Children Test
        String dc = mongoUtil.regexChildren("/abc");
        verify("/abc/def".matches(dc));
        verify("/abc/abc".matches(dc));
        verify(!"/abc/def/x".matches(dc));
        verify(!"/abc/def/x/".matches(dc));
        verify(!"/abc/def/".matches(dc));
        verify(!"/abc/def/abc".matches(dc));
        verify(!"/arq/def/abc".matches(dc));
        verify(!"/abc/def/abc/".matches(dc));
        verify(!"/abc/abc/abc/".matches(dc));
        verify(!"/abcx".matches(dc));
        // Recursive Children Test
        String rc = mongoUtil.regexSubGraph("/abc");
        verify("/abc/x".matches(rc));
        verify("/abc/def".matches(rc));
        verify("/abc/def/x".matches(rc));
        verify("/abc/def/xyz/nop".matches(rc));
        verify(!"/abcx".matches(rc));
        // the final slash is built into the query.
        verify(!"/abc".matches(rc));
        log.debug("All REGEX Path tests ok.");
    }

    public void verify(boolean val) {
        if (!val) {
            throw new RuntimeException("Assertion failed.");
        }
    }

    public void runBinaryTests(MongoSession ms) {
        log.debug("Running binaries tests.");
        try {
            SubNode node = create.createNode(ms, "/binaries");
            update.save(ms, node);
            long maxFileSize = user.getUserStorageRemaining(ms);
            attach.writeStream(ms, false, "", node,
                    new LimitedInputStreamEx(new FileInputStream("/home/clay/test-image.png"), maxFileSize), null,
                    "image/png", null);
            update.save(ms, node);
            log.debug("inserted root for binary testing.", null, "image/png", null);
            InputStream inStream = attach.getStream(ms, "", node, true);
            FileUtils.copyInputStreamToFile(inStream, new File("/home/clay/test-image2.png"));
            log.debug("completed reading back the file, and writing out a copy.");
        } catch (Exception e) {
            throw new RuntimeEx(e);
        }
    }

    private MongoSession asUser(String userName) {
        SubNode userNode = read.getAccountByUserName(null, userName, false);
        if (userNode == null) {
            throw new RuntimeException("UserNode not found for userName " + userName);
        }
        MongoSession ms = new MongoSession(userName, userNode.getId());
        asSession(ms);
        return ms;
    }

    private void asSession(MongoSession ms) {
        ThreadLocals.setMongoSession(ms);
    }
}
