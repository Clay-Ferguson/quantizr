package quanta.mongo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;
import quanta.AppServer;
import quanta.config.AppStartupEvent;
import quanta.config.ServiceBase;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.Util;

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
                    if (ServiceBase.svc_mongoRepo != null) {
                        log.debug("********** runtime shutdownHook executing. **********");
                        ServiceBase.svc_mongoRepo.close();
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
            
            TL.setSC(svc_auth.getAdminSC());
            svc_user.createAdminUser();
            // DO NOT DELETE
            // mongoUtil.upgradePaths(as);
            // mongoUtil.processAccounts(as);
            /* can shutdown during startup. */
            if (AppServer.isShuttingDown())
                return;
            log.debug("initializing MongoRepository");
            // IMPORTANT: Do not move this line below this point. An infinite loop of re-entry can occur into
            // this method because of calls to getRepository() always doing an init.
            initialized = true;
            try {
                svc_mongoUtil.createAllIndexes();
            } catch (Exception e) {
                ExUtil.error(log, "Failed in createAlIndexes", e);
            }
            try {
                svc_user.createTestAccounts();
            } catch (Exception e) {
                ExUtil.error(log, "Failed in createTestAccounts", e);
            }
            log.debug("MongoRepository fully initialized.");
            fullInit = true;
            // broadcast to all other parts of the app that the DB is now live and ready.
            svc_pub.getPublisher().publishEvent(new AppStartupEvent());
            svc_mongoDelete.removeAbandonedNodes();

            if (svc_prop.getRssPreCacheEnabled()) {
                svc_async.run(() -> {
                    // wait 120 seconds before starting to pre-cache the RSS feeds
                    Util.sleep(120000);
                    svc_arun.run(() -> {
                        svc_rssFeed.preCacheAdminFeeds();
                        return null;
                    });
                });
            }
        }
    }

    public void close() {
        AppServer.setShuttingDown(true);
        if (ServiceBase.svc_mongoRepo == null)
            return;
        synchronized (lock) {
            try {
                log.debug("Closing MongoClient connection.");
                svc_mac.mongoClient().close();
            } finally {
                ServiceBase.svc_mongoRepo = null;
            }
        }
    }
}
