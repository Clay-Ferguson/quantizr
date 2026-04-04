package quanta.test;

import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

@Component 
public class TestUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(TestUtil.class);
    private StringBuilder testResults = new StringBuilder();

    @Autowired
    private Environment env;

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        super.handleContextRefresh(event);

        if ("true".equals(env.getProperty("runJUnit"))) {
            runTests();
        }
    }

    public void runTests() {
        testResults.setLength(0);
        log("*************** Running JUnit tests (t=" + String.valueOf(System.currentTimeMillis()) + ")");
        runTest("quanta.test.UnitTest");
        log.debug("***************************************************");
    }

    private void runTest(String className) {
        try {
            Class<?> testClass = Class.forName(className);
            log("Running test class: " + testClass.getName());
            Result result = JUnitCore.runClasses(testClass);
            if (result.getFailureCount() > 0) {
                for (Failure failure : result.getFailures()) {
                    log("TEST FAILED: " + failure.toString());
                }
            } else {
                log("All tests passed!");
            }

        } catch (Exception e) {
            log.error("Error running test class: " + className, e);
        }
    }

    public void log(String msg) {
        log.debug("TestUtil: " + msg);
        testResults.append(msg);
        testResults.append("\n");
    }

    public StringBuilder getTestResults() {
        return testResults;
    }

    public void setTestResults(StringBuilder testResults) {
        this.testResults = testResults;
    }
}
