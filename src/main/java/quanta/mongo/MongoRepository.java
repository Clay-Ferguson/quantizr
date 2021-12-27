package quanta.mongo;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.util.ThreadLocals;

/**
 * Models the MongoDB repository connection.
 */
@Component
public class MongoRepository extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(MongoRepository.class);

	// hack for now to make RSS deamon wait.
	public static boolean fullInit = false;

	/*
	 * We only need this lock to protect against startup and/or shutdown concurrency. Remember during
	 * debugging, etc the server process can be shutdown (CTRL-C) even while it's in the startup phase.
	 */
	private static final Object lock = new Object();

	private boolean initialized = false;

	@PostConstruct
	public void postConstruct() {
		ServiceBase.mongoRepo = this;
	}

	/*
	 * Warning: Spring will NOT be fully initialized in this constructor when this runs.
	 * Use @PostConstruct instead for spring processing.
	 */
	public MongoRepository() {
		Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
			@Override
			public void run() {
				synchronized (lock) {
					if (ok(ServiceBase.mongoRepo)) {
						log.debug("********** runtime shutdownHook executing. **********");
						ServiceBase.mongoRepo.close();
					}
				}
			}
		}));
	}

	@PreDestroy
	public void preDestroy() {
		log.debug("MongoRepository.preDestroy running.");
		close();
	}

	/*
	 * Called from SpringContextUtil#setApplicationContext, because we want to call only after all of
	 * Spring context is fully initialized
	 */
	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		log.debug("ContextRefreshedEvent");
		if (initialized)
			return;

		synchronized (lock) {
			if (initialized)
				return;

			MongoSession as = auth.getAdminSession();
			ThreadLocals.setMongoSession(as);
			mongoUtil.createAdminUser(as);

			/* can shutdown during startup. */
			if (AppServer.isShuttingDown())
				return;

			log.debug("initializing MongoRepository");

			/*
			 * IMPORTANT: Do not move this line below this point. An infinite loop of re-entry can occur into
			 * this method because of calls to getRepository() always doing an init.
			 */
			initialized = true;
			mongoUtil.createAllIndexes(as);
			mongoUtil.createTestAccounts();

			log.debug("MongoRepository fully initialized.");
			fullInit = true;

			delete.removeAbandonedNodes(as);
			apub.refreshForeignUsers();
		}
	}

	public void close() {
		AppServer.setShuttingDown(true);
		if (no(ServiceBase.mongoRepo))
			return;

		synchronized (lock) {
			try {
				log.debug("Closing MongoClient connection.");
				mac.mongoClient().close();
			} finally {
				ServiceBase.mongoRepo = null;
			}
		}
	}
}
