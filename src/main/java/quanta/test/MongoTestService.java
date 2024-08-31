package quanta.test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import java.io.InputStream;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.ForbiddenException;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;

@Component("MongoTestService") 
public class MongoTestService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoTestService.class);

    public void test() throws Exception {
        svc_testUtil.log("MongoTest Running");

        authTest();
        testPathRegex();
        runBinaryTests();

        svc_testUtil.log("Mongo Test Completed.");
    }

    /**
     * In this test 'admin' creates a node and a child of that node, and then user 'adam' attempts to do
     * several kinds of operations he should not be allowed to do, and then some he should be allowed to
     */
    public void authTest() {
        svc_auth.asUser(PrincipalName.ADMIN.s());

        AccountNode adminNode = svc_user.getAccountByUserNameAP(PrincipalName.ADMIN.s());
        assertNotNull("Checking adminNode existed", adminNode);

        // root for all testing. Note: '?' indicates to find any available path (generates a new path)
        SubNode testingRoot = svc_mongoCreate.createNode("/r/?");
        testingRoot.setContent("Root for Testing");
        svc_mongoUpdate.save(testingRoot);

        // Insert a test node
        SubNode adminsChild = svc_mongoCreate.createNode(testingRoot.getPath() + "/?");
        adminsChild.setContent("admin's test node " + System.currentTimeMillis());
        svc_mongoUpdate.save(adminsChild);
        ObjectId insertedId = adminsChild.getId();
        svc_testUtil.log("admin inserted a node: " + insertedId.toString());

        // login as adam
        svc_auth.asUser("adam");

        // adam tries to set the path on adminsNode
        try {
            adminsChild.setPath(adminsChild.getPath() + "abc");
            svc_mongoUpdate.save(adminsChild);
            throw new RuntimeException("failed to block path alter.");
        } catch (ForbiddenException e) {
            svc_testUtil.log("Successful path alter blocked.");
        }

        // let adam try and fail to access insertedId
        try {
            @SuppressWarnings("unused")
            SubNode updateNode = svc_mongoRead.getNode(insertedId);
            throw new RuntimeException("failed to block.");
        } catch (ForbiddenException e) {
            svc_testUtil.log("Successful auth block.");
        }

        boolean success = false;
        // adam attempts and fails to create a node in a protected area
        try {
            svc_testUtil.log("Test reject for being invalid root insert.");
            SubNode adamsNode = svc_mongoCreate.createNode(testingRoot.getPath() + "/?");
            adamsNode.setContent("adam's test node (should not save 1) " + System.currentTimeMillis());
            svc_mongoUpdate.save(adamsNode);
        } catch (Exception e) {
            log.debug("Caught expected exception: " + e);
            success = true;
            svc_testUtil.log("successfully blocked invalid create (in root)");
        }
        assertTrue("rejected invalid insert", success);

        long childCount = svc_mongoRead.getChildCountRecursive(testingRoot.getPath());
        assertEquals("childCount Check", childCount, 1);

        // adam attempts and fails to create a node under adminsNode
        success = false;
        try {
            svc_testUtil.log("Insecure insert test (under adminsChild)");
            SubNode adamsNode = svc_mongoCreate.createNode(adminsChild.getPath() + "/?");
            adamsNode.setContent("adam's test node (should not save 2)" + System.currentTimeMillis());
            svc_mongoUpdate.save(adamsNode);
        } catch (Exception e) {
            success = true;
            svc_testUtil.log("successfully blocked invalid create (in an admin node)");
        }
        assertTrue("disallowed insert text", success);

        childCount = svc_mongoRead.getChildCountRecursive(testingRoot.getPath());
        assertEquals(childCount, 1);

        // adam successfully inserts node in his root
        SubNode adamsNode = null;
        AccountNode adamsRootNode = svc_user.getAccountByUserNameAP("adam");
        assertTrue(adamsRootNode != null);

        adamsNode = svc_mongoCreate.createNode(adamsRootNode.getPath() + "/?");
        adamsNode.setContent("adam's test node (should save ok)" + System.currentTimeMillis());
        svc_mongoUpdate.save(adamsNode);
        insertedId = adamsNode.getId();
        svc_testUtil.log("adam inserted a node: " + insertedId.toString());

        // admin tries to save a duplicated path
        svc_auth.asUser(PrincipalName.ADMIN.s());
        adamsNode.setPath(adminsChild.getPath());
        success = false;
        try {
            svc_mongoUpdate.save(adamsNode);
        } catch (DuplicateKeyException e) {
            success = true;
            svc_testUtil.log("Successfully rejected key dup.");
        }
        adamsNode = null; // set to null now that we monkeyed with the path
        assertTrue("reject dup key", success);

        // adam tries and fails to save adminsNode
        svc_auth.asUser("adam");
        success = false;
        try {
            svc_testUtil.log("Attempting save by wrong user.");
            svc_mongoUpdate.save(adminsChild);
        } catch (ForbiddenException e) {
            success = true;
            svc_testUtil.log("Successfully blocked save by wrong user.");
        }
        assertTrue("wrong user insert", success);

        svc_auth.asUser(PrincipalName.ADMIN.s());
        childCount = svc_mongoRead.getChildCount(testingRoot.getPath());
        assertEquals("childCount Check", 1, childCount);

        String testingRootPath = testingRoot.getPath();
        long delCount = svc_mongoDelete.delete(testingRoot, false);
        svc_testUtil.log("Deleted " + delCount + " nodes by deleting " + testingRootPath);

        childCount = svc_mongoRead.getChildCountRecursive(testingRootPath);
        assertEquals("childCount after test root Del: ", 0, childCount);
    }

    public void testPathRegex() {
        // Direct Children Test
        String dc = svc_mongoUtil.regexChildren("/abc");
        assertTrue("/abc/def".matches(dc));
        assertTrue("/abc/de".matches(dc));
        assertTrue("/abc/d".matches(dc));
        assertFalse("/abc".matches(dc));
        assertFalse("/abc/".matches(dc));
        assertFalse("/abc/def/x".matches(dc));
        assertFalse("/abc/def/x/".matches(dc));
        assertFalse("/abc/def/".matches(dc));
        assertFalse("/abc/def/abc".matches(dc));
        assertFalse("/arq/def/abc".matches(dc));
        assertFalse("/abc/def/abc/".matches(dc));
        assertFalse("/abc/abc/abc/".matches(dc));
        assertFalse("/abcx".matches(dc));
        assertFalse("/abcx/".matches(dc));

        // Recursive Children Test
        String rc = svc_mongoUtil.regexSubGraph("/abc");
        assertFalse("/abc".matches(rc));
        assertTrue("/abc/x".matches(rc));
        assertTrue("/abc/def".matches(rc));
        assertTrue("/abc/def/x".matches(rc));
        assertTrue("/abc/def/xyz/nop".matches(rc));
        assertFalse("/abcx".matches(rc));

        rc = svc_mongoUtil.regexSubGraphAndRoot("/abc");
        assertTrue("/abc".matches(rc));
        assertTrue("/abc/x".matches(rc));
        assertTrue("/abc/def".matches(rc));
        assertTrue("/abc/def/x".matches(rc));
        assertTrue("/abc/def/xyz/nop".matches(rc));
        assertFalse("/abcx".matches(rc));

        svc_testUtil.log("All REGEX Path tests ok.");
    }

    public void runBinaryTests() throws Exception {
        svc_testUtil.log("Running binaries tests.");
        svc_auth.asUser(PrincipalName.ADMIN.s());

        // root for all testing. Note: '?' indicates to find any available path (generates a new path)
        SubNode testingRoot = svc_mongoCreate.createNode("/r/?");
        testingRoot.setContent("Root for Upload Testing");
        svc_mongoUpdate.save(testingRoot);

        InputStream is = null;
        String resourceName = "classpath:/public/branding/logo-50px-tr.jpg";
        try {
            Resource resource = context.getResource(resourceName);
            is = resource.getInputStream();

            long maxFileSize = svc_user.getUserStorageRemaining();
            svc_attach.writeStream(false, "att-name", testingRoot, new LimitedInputStreamEx(is, maxFileSize),
                    "file-name", "image/jpeg", null);
            svc_mongoUpdate.save(testingRoot);
            svc_testUtil.log("inserted root for binary testing.");

            svc_mongoDelete.delete(testingRoot, false);
        } finally {
            StreamUtil.close(is);
        }
    }
}
