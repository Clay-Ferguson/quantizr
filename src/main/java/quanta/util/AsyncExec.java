package quanta.util;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

/*
 * Wraps execution of a Runnable by the spring executor service. Warning: Don't try to refactor to
 * use
 *
 * @Async annotation. That approach is dangerous and won't work in all scenarios
 */
@Component
public class AsyncExec extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AsyncExec.class);

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    public Executor executor;

    // Reflects the true concurrently count, and should represent the current number of running threads
    // at all times.
    int execCounter = 0;
    int maxExecCounter = 0; // max value for execCounter ever

    public void run(Runnable runnable) {
        run(new ThreadLocalsContext(), runnable);
    }

    private void run(ThreadLocalsContext tlc, Runnable runnable) {
        // We have to get the stackTrace ahead of time, so that if the async thread fails we can log
        // what was actually happening that launched the executor/thread that failed.
        String stackTrace = ExUtil.getStackTrace(null);

        executor.execute(new Runnable() {
            public void run() {
                try {
                    execCounter++;
                    if (execCounter > maxExecCounter) {
                        maxExecCounter = execCounter;
                    }
                    if (tlc != null) {
                        tlc.setValsIntoThread();
                    }
                    runnable.run();
                } catch (Exception e) {
                    ExUtil.error(log, "exception in AsyncExec", e);
                    log.error("AsyncExec that failed was started by: " + stackTrace);
                } finally {
                    ThreadLocals.removeAll();
                    execCounter--;
                    // log.error("AsyncExec exiting. Started by: " + stackTrace);
                }
            }
        });
    }
}
