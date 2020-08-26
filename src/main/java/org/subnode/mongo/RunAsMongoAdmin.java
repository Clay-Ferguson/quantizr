package org.subnode.mongo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.util.MongoRunnable;

/**
 * Helper class to run some processing workload as the admin user. Simplifies by encapsulating the
 * session management at this abstracted layer. Run primarily as a Java-8 Lambda, and working very
 * similar to what is also known as an AOP aspect, although not using an 'aspect' but mainly just a
 * Lambda (i.e. 'Functional Interface')
 */
@Component
public class RunAsMongoAdmin {
	private static final Logger log = LoggerFactory.getLogger(RunAsMongoAdmin.class);

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoAuth auth;

	public void run(MongoRunnable runner) {
		MongoSession session = null;

		try {
			session = auth.getAdminSession();
			runner.run(session);
			update.saveSession(session);
		}
		catch (Exception ex) {
			log.error("error", ex);
			throw ex;
		}
	}
}
