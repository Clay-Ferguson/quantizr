package quanta.test;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.config.ServiceBase;

@RunWith(JUnit4.class) // This tells JUnit to run the test using JUnit4 runner
public class MongoTest {
    private static Logger log = LoggerFactory.getLogger(MongoTest.class);

    @Test
    public void test() {
        try {
            MongoTestService mts = ServiceBase.context.getBean(MongoTestService.class);
            mts.test();
        } catch (Exception e) {
            log.error("MongoTest Failed", e);
        }
    }
}
