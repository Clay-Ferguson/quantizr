package quanta.test;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.config.ServiceBase;

@RunWith(JUnit4.class) // This tells JUnit to run the test using JUnit4 runner
public class UnitTest {
    private static Logger log = LoggerFactory.getLogger(UnitTest.class);

    @Test
    public void test() throws Exception {
        try {
            // MongoTestService mts = ServiceBase.context.getBean(MongoTestService.class);
            // mts.test();
            // RSSTestService rss = ServiceBase.context.getBean(RSSTestService.class);
            // rss.test();
            log.debug("***Unit Test Running!***");
        } catch (Exception e) {
            log.error("MongoTest Failed", e);
            throw e;
        }
    }
}
