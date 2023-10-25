package quanta.test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import org.apache.commons.io.FileUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.ForbiddenException;
import quanta.exception.base.RuntimeEx;
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

    public static boolean debug = false;

    public void test() throws Exception {
        testUtil.log("MongoTest Running");

        authTest();

        // testDirtyReads();
        // testPathRegex();

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
        // testUtil.log("updated first node.");
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
        testUtil.log("Mongo Test Completed.");
    }

    /**
     * In this test 'admin' creates a node and a child of that node, and then user 'adam' attempts to do
     * several kinds of operations he should not be allowed to do, and then some he should be allowed to
     */
    public void authTest() {
        MongoSession as = asUser(PrincipalName.ADMIN.s());
        SubNode adminNode = read.getAccountByUserName(as, PrincipalName.ADMIN.s(), false);
        assertNotNull("Checking adminNode existed", adminNode);

        // root for all testing. Note: '?' indicates to find any available path (generates a new path)
        SubNode testingRoot = create.createNode(as, "/r/?");
        testingRoot.setContent("Root for Testing");
        update.save(as, testingRoot);

        // Insert a test node
        SubNode adminsChild = create.createNode(as, testingRoot.getPath() + "/?");
        adminsChild.setContent("admin's test node " + System.currentTimeMillis());
        update.save(as, adminsChild);
        ObjectId insertedId = adminsChild.getId();
        testUtil.log("admin inserted a node: " + insertedId.toString());

        // login as adam
        MongoSession adamSession = asUser("adam");

        // adam tries to set the path on adminsNode
        try {
            adminsChild.setPath(adminsChild.getPath() + "abc");
            update.save(adamSession, adminsChild);
            throw new RuntimeException("failed to block path alter.");
        } catch (ForbiddenException e) {
            testUtil.log("Successful path alter blocked.");
        }

        // let adam try and fail to access insertedId
        try {
            SubNode updateNode = read.getNode(adamSession, insertedId);
            throw new RuntimeException("failed to block.");
        } catch (ForbiddenException e) {
            testUtil.log("Successful auth block.");
        }

        boolean success = false;
        // adam attempts and fails to create a node in a protected area
        try {
            testUtil.log("Test reject for being invalid root insert.");
            SubNode adamsNode = create.createNode(adamSession, testingRoot.getPath() + "/?");
            adamsNode.setContent("adam's test node (should not save 1) " + System.currentTimeMillis());
            update.save(adamSession, adamsNode);
        } catch (Exception e) {
            log.debug("Caught expected exception: " + e);
            success = true;
            testUtil.log("successfully blocked invalid create (in root)");
        }
        assertTrue("rejected invalid insert", success);

        long childCount = read.getChildCountRecursive(as, testingRoot.getPath());
        assertEquals("childCount Check", childCount, 1);

        // adam attempts and fails to create a node under adminsNode
        success = false;
        try {
            testUtil.log("Insecure insert test (under adminsChild)");
            SubNode adamsNode = create.createNode(adamSession, adminsChild.getPath() + "/?");
            adamsNode.setContent("adam's test node (should not save 2)" + System.currentTimeMillis());
            update.save(adamSession, adamsNode);
        } catch (Exception e) {
            success = true;
            testUtil.log("successfully blocked invalid create (in an admin node)");
        }
        assertTrue("disallowed insert text", success);

        childCount = read.getChildCountRecursive(as, testingRoot.getPath());
        assertEquals(childCount, 1);

        // adam successfully inserts node in his root
        SubNode adamsNode = null;
        SubNode adamsRootNode = read.getAccountByUserName(adamSession, "adam", false);
        assertTrue(adamsRootNode != null);

        adamsNode = create.createNode(adamSession, adamsRootNode.getPath() + "/?");
        adamsNode.setContent("adam's test node (should save ok)" + System.currentTimeMillis());
        update.save(adamSession, adamsNode);
        insertedId = adamsNode.getId();
        testUtil.log("adam inserted a node: " + insertedId.toString());

        // admin tries to save a duplicated path
        as = asUser(PrincipalName.ADMIN.s());
        adamsNode.setPath(adminsChild.getPath());
        success = false;
        try {
            ThreadLocals.setMongoSession(as);
            update.save(as, adamsNode);
        } catch (DuplicateKeyException e) {
            success = true;
            testUtil.log("Successfully rejected key dup.");
        }
        adamsNode = null; // set to null now that we monkeyed with the path
        assertTrue("reject dup key", success);

        // adam tries and fails to save adminsNode
        adamSession = asUser("adam");
        success = false;
        try {
            testUtil.log("Attempting save by wrong user.");
            ThreadLocals.setMongoSession(adamSession);
            update.save(adamSession, adminsChild);
        } catch (ForbiddenException e) {
            success = true;
            testUtil.log("Successfully blocked save by wrong user.");
        }
        assertTrue("wrong user insert", success);

        as = asUser(PrincipalName.ADMIN.s());
        childCount = read.getChildCount(as, testingRoot.getPath());
        assertEquals("childCount Check", 1, childCount);

        String testingRootPath = testingRoot.getPath();
        long delCount = delete.delete(as, testingRoot, false);
        testUtil.log("Deleted " + delCount + " nodes by deleting " + testingRootPath);

        childCount = read.getChildCountRecursive(as, testingRootPath);
        assertEquals("childCount after test root Del: ", 0, childCount);
    }

    public void testPathRegex() {
        // Direct Children Test
        String dc = mongoUtil.regexChildren("/abc");
        assertTrue("/abc/def".matches(dc));
        assertTrue("/abc/abc".matches(dc));
        assertTrue(!"/abc/def/x".matches(dc));
        assertTrue(!"/abc/def/x/".matches(dc));
        assertTrue(!"/abc/def/".matches(dc));
        assertTrue(!"/abc/def/abc".matches(dc));
        assertTrue(!"/arq/def/abc".matches(dc));
        assertTrue(!"/abc/def/abc/".matches(dc));
        assertTrue(!"/abc/abc/abc/".matches(dc));
        assertTrue(!"/abcx".matches(dc));

        // Recursive Children Test
        String rc = mongoUtil.regexSubGraph("/abc");
        assertTrue("/abc/x".matches(rc));
        assertTrue("/abc/def".matches(rc));
        assertTrue("/abc/def/x".matches(rc));
        assertTrue("/abc/def/xyz/nop".matches(rc));
        assertTrue(!"/abcx".matches(rc));

        // the final slash is built into the query.
        assertTrue(!"/abc".matches(rc));
        testUtil.log("All REGEX Path tests ok.");
    }

    public void runBinaryTests(MongoSession ms) {
        testUtil.log("Running binaries tests.");
        try {
            SubNode node = create.createNode(ms, "/binaries");
            update.save(ms, node);
            long maxFileSize = user.getUserStorageRemaining(ms);
            attach.writeStream(ms, false, "", node,
                    new LimitedInputStreamEx(new FileInputStream("/home/clay/test-image.png"), maxFileSize), null,
                    "image/png", null);
            update.save(ms, node);
            testUtil.log("inserted root for binary testing.");
            InputStream inStream = attach.getStream(ms, "", node, true);
            FileUtils.copyInputStreamToFile(inStream, new File("/home/clay/test-image2.png"));
            testUtil.log("completed reading back the file, and writing out a copy.");
        } catch (Exception e) {
            throw new RuntimeEx(e);
        }
    }

    private MongoSession asUser(String userName) {
        SubNode userNode = read.getAccountByUserName(null, userName, false);
        if (userNode == null) {
            throw new RuntimeException("UserNode not found for userName " + userName);
        }

        SessionContext sc = new SessionContext();
        sc.setUserName(userName);
        sc.setUserNodeId(userNode.getIdStr());
        ThreadLocals.setSC(sc);

        MongoSession ms = new MongoSession(userName, userNode.getId());
        ThreadLocals.setMongoSession(ms);
        return ms;
    }
}
