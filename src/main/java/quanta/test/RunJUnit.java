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
import test.TestIntf;

@Component
public class RunJUnit extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(RunJUnit.class);

    @Autowired
    private Environment env;

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        super.handleContextRefresh(event);

        if ("true".equals(env.getProperty("runJUnit"))) {
            log.debug("*************** Running JUnit tests ***************");
            runTests();
            log.debug("***************************************************");
        }
    }

    public static void runTests() {
        runTest("test.MyTest");
    }

    public static void runBeanTest(String testClass) {
        try {
            TestIntf testInst = (TestIntf) context.getBean(testClass);
            testInst.test();
        } catch (Exception e) {
            log.error("Error running test bean: " + testClass, e);
        }
    }

    private static void runTest(String className) {
        try {
            Class<?> testClass = Class.forName(className);
            log.debug("Running test class: " + testClass.getName());
            Result result = JUnitCore.runClasses(testClass);
            for (Failure failure : result.getFailures()) {
                log.debug(failure.toString());
            }
            log.debug("Tests Success: " + result.wasSuccessful());
        } catch (Exception e) {
            log.error("Error running test class: " + className, e);
        }
    }
}
