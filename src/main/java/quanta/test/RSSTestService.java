package quanta.test;

import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import quanta.config.ServiceBase;
import quanta.util.StreamUtil;

@Component("RSSTestService") 
public class RSSTestService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(RSSTestService.class);

    public void test() throws Exception {
        svc_testUtil.log("RSSTest Running");

        String fileName = "classpath:public/data/rss-test.xml";
        Resource resource = context.getResource(fileName);
        InputStream is = resource.getInputStream();
        try {
            log.debug("READING FEED: " + fileName);
            SyndFeedInput input = new SyndFeedInput();
            XmlReader xmlReader = new XmlReader(is, true);
            SyndFeed inFeed = input.build(xmlReader);
            if (inFeed!=null) {
                log.debug("Feed Title: " + inFeed.getTitle());
                log.debug("Feed Description: " + inFeed.getDescription());
                log.debug("Feed Published Date: " + inFeed.getPublishedDate());
            }
        } 
        catch (Exception e) {
            log.error("Error reading XML: " + fileName, e);
            throw e;
        }
        finally {
            StreamUtil.close(is);
        }

        svc_testUtil.log("RSS Test Completed.");
    }
}
