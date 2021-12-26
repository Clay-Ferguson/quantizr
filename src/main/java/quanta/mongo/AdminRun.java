package quanta.mongo;

import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.util.MongoRunnableEx;
import quanta.util.ThreadLocals;

/**
 * Helper class to run some processing workload as the admin user. Simplifies by encapsulating the
 * session management at this abstracted layer. Run primarily as a Java-8 Lambda, and working very
 * similar to what is also known as an AOP aspect, although not using an 'aspect' but mainly just a
 * Lambda (i.e. 'Functional Interface')
 */
@Component
public class AdminRun extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(AdminRun.class);

	@PostConstruct
	public void postConstruct() {
		arun = this;
	}

	public <T> T run(MongoRunnableEx<T> runner) {
		MongoSession ms = null;
		MongoSession savedMs = null;
		T ret = null;
		try {
			savedMs = ThreadLocals.getMongoSession();
			ThreadLocals.setMongoSession(ms = auth.getAdminSession());
			ret = runner.run(ms);
			update.saveSession(ms, true);
		} catch (Exception ex) {
			log.error("error", ex);
			throw ex;
		} finally {
			ThreadLocals.setMongoSession(savedMs);
		}
		return ret;
	}
}
