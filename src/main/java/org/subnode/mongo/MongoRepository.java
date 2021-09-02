package org.subnode.mongo;

import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.AppServer;
import org.subnode.actpub.ActPubService;
import org.subnode.config.AppProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.util.ThreadLocals;

@Component
public class MongoRepository {
	private static final Logger log = LoggerFactory.getLogger(MongoRepository.class);

	// hack for now to make RSS deamon wait.
	public static boolean fullInit = false;

	@Autowired
	private MongoAppConfig mac;

	@Autowired
	private MongoRead read;

	@Autowired
	private AppProp appProp;

	@Autowired
	private MongoUtil repoUtil;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoDelete delete;

	@Autowired
	private ActPubService actPub;

	/*
	 * Because of the criticality of this variable, I am not using the Spring getter to get it, but just
	 * using a private static. It's slightly safer and better for the purpose of cleanup in the shutdown
	 * hook which is all it's used for.
	 */
	private static MongoRepository instance;

	/*
	 * We only need this lock to protect against startup and/or shutdown concurrency. Remember during
	 * debugging, etc the server process can be shutdown (CTRL-C) even while it's in the startup phase.
	 */
	private static final Object lock = new Object();

	private boolean initialized = false;

	/*
	 * Warning: Spring will NOT be fully initialized in this constructor when this runs.
	 * Use @PostConstruct instead for spring processing.
	 */
	public MongoRepository() {
		instance = this;

		Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
			@Override
			public void run() {
				if (instance != null) {
					log.debug("********** runtime shutdownHook executing. **********");
					instance.close();
				}
			}
		}));
	}

	@PreDestroy
	public void preDestroy() {
		close();
	}

	/*
	 * Called from SpringContextUtil#setApplicationContext, because we want to call only after all of
	 * Spring context is fully initialized
	 */
	public void init() {
		if (initialized)
			return;

		MongoSession adminSession = new MongoSession(PrincipalName.ADMIN.s());
		ThreadLocals.setMongoSession(adminSession);

		synchronized (lock) {
			if (initialized)
				return;

			/* can shutdown during startup. */
			if (AppServer.isShuttingDown())
				return;

			log.debug("initializing MongoRepository");

			/*
			 * IMPORTANT: Do not move this line below this point. An infinite loop of re-entry can occur into
			 * this method because of calls to getRepository() always doing an init.
			 */
			initialized = true;

			// ensure the root variable is set.
			read.getDbRoot();

			if (appProp.getForceIndexRebuild()) {
				util.dropAllIndexes(adminSession);
			}

			util.createAllIndexes(adminSession);
			util.createAdminUser(adminSession);
			repoUtil.createTestAccounts();

			if (appProp.getReSaveAll()) {
				util.reSaveAll(adminSession);
			}

			// update.runRepairs();

			log.debug("MongoRepository fully initialized.");
			fullInit = true;
		}

		delete.removeAbandonedNodes(adminSession);
		actPub.refreshForeignUsers();
	}

	public void close() {
		AppServer.setShuttingDown(true);
		if (instance == null)
			return;

		synchronized (lock) {
			try {
				log.debug("Closing MongoClient connection.");
				mac.mongoClient().close();
			} finally {
				instance = null;
			}
		}
	}
}
