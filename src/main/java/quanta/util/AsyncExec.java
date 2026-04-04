package quanta.util;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

/**
 * Wraps execution of a Runnable by the spring executor service. Warning: Don't try to refactor to
 * use
 *
 * @Async annotation. That approach is dangerous and won't work in all scenarios
 */
@Component
public class AsyncExec extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AsyncExec.class);

    @Autowired
    public ThreadPoolTaskScheduler threadPoolTaskScheduler;

    // Reflects the true concurrently count, and should represent the current number of running threads
    // at all times.
    int execCounter = 0;
    int maxExecCounter = 0; // max value for execCounter ever

    public void run(Runnable runnable) {
        run(new ThreadLocalsContext(), runnable);
    }

    /**
     * Executes a given Runnable asynchronously within a specific ThreadLocalsContext.
     * 
     * @param tlc the ThreadLocalsContext to set values into the thread, can be null
     * @param runnable the Runnable to be executed asynchronously
     * 
     *        This method captures the current stack trace before executing the Runnable to aid in
     *        debugging if the asynchronous execution fails. It increments an execution counter to track
     *        the number of concurrent executions and updates the maximum concurrent executions if
     *        necessary. If a ThreadLocalsContext is provided, it sets the context values into the
     *        thread before running the Runnable. Any exceptions thrown during the execution are logged
     *        along with the captured stack trace. Finally, it ensures that thread-local variables are
     *        removed and decrements the execution counter.
     */
    private void run(ThreadLocalsContext tlc, Runnable runnable) {
        // We have to get the stackTrace ahead of time, so that if the async thread fails we can log
        // what was actually happening that launched the executor/thread that failed.
        String stackTrace = ExUtil.getStackTrace(null);

        Runnable r = new Runnable() {
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
                    TL.removeAll();
                    execCounter--;
                    // log.error("AsyncExec exiting. Started by: " + stackTrace);
                }
            }
        };

        // DO NOTE DELETE
        // NOTE: You can also pass triggers like this instead of 'instant' below.
        // PeriodicTrigger periodicTrigger
        // = new PeriodicTrigger(2000, TimeUnit.MICROSECONDS);

        // get instant from current time
        Instant instant = Instant.now(); // we start now, but we could add time if we wanted to delay
        threadPoolTaskScheduler.schedule(r, instant);
    }
}


// DO NOT DELETE. leave this as FYI.
// This code works to do async similar to the code above, but we don't do this (@Async) because we
// have more control with the code above than we do with this method.
// @Component
// public class AsyncLayer extends ServiceBase {
// private static Logger log = LoggerFactory.getLogger(AsyncLayer.class);
// @Async
// public CompletableFuture<Void> run(Runnable runnable) {
// runnable.run();
// return CompletableFuture.completedFuture(null);
// }
// }
