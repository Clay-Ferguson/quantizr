package quanta.mongo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;

/**
 * Models the MongoDB repository connection.
 */
@Component
public class MongoRepository extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoRepository.class);

    /*
     * Flag only gets set to true when application is fully initialized, all DB conversiona have been
     * done and all endpoints are ready to start servicing requests
     */
    public static boolean fullInit = false;
    /*
     * We only need this lock to protect against startup and/or shutdown concurrency. Remember during
     * debugging, etc the server process can be shutdown (CTRL-C) even while it's in the startup phase.
     */
    private static final Object lock = new Object();
    private boolean initialized = false;

    public MongoRepository() {
        Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
            @Override
            public void run() {
                synchronized (lock) {
                    if (ServiceBase.mongoRepo != null) {
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

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        super.handleContextRefresh(event);
        log.debug("ContextRefreshedEvent");
        if (initialized)
            return;
        synchronized (lock) {
            if (initialized)
                return;
            MongoSession as = auth.getAdminSession();
            ThreadLocals.setMongoSession(as);
            mongoUtil.createAdminUser(as);
            // DO NOT DELETE
            // mongoUtil.setParentNodes(as);
            // mongoUtil.deleteNostrUsers(as);
            // mongoUtil.processAccounts(as);
            /* can shutdown during startup. */
            if (AppServer.isShuttingDown())
                return;
            log.debug("initializing MongoRepository");
            /*
             * IMPORTANT: Do not move this line below this point. An infinite loop of re-entry can occur into
             * this method because of calls to getRepository() always doing an init.
             */
            initialized = true;
            try {
                mongoUtil.createAllIndexes(as);
            } catch (Exception e) {
                ExUtil.error(log, "Failed in createAlIndexes", e);
            }
            try {
                mongoUtil.createTestAccounts();
            } catch (Exception e) {
                ExUtil.error(log, "Failed in createTestAccounts", e);
            }
            log.debug("MongoRepository fully initialized.");
            fullInit = true;
            // broadcast to all other parts of the app that the DB is now live and ready.
            publisher.getPublisher().publishEvent(new AppStartupEvent());
            delete.removeAbandonedNodes(as);
            // apub.refreshForeignUsers();
            system.cacheAdminNodes();

            opsw.dropCollection("fediNames");
        }
    }

    public void close() {
        AppServer.setShuttingDown(true);
        if (ServiceBase.mongoRepo == null)
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
