package quanta.util;

import static quanta.util.Util.ok;
import java.util.concurrent.Executor;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

/*
 * Wraps execution of a Runnable by the spring executor service. Warning: Don't try to refactor to use
 * @Async annotation. That approach is dangerous and won't work in all scenarios
 */
@Component
public class AsyncExec extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(AsyncExec.class);

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    public Executor executor;

    // Reflects the true concurrently count, and should represent the current number of running threads
    // at all times.
    int execCounter = 0;
    int maxExecCounter = 0; // max value for execCounter ever

    @PostConstruct
    public void postConstruct() {
        exec = this;
    }

    public void run(Runnable runnable) {
        run(ThreadLocals.getContext(), runnable);
    }

    public void run(ThreadLocalsContext tlc, Runnable runnable) {
        executor.execute(new Runnable() {
            public void run() {
                try {
                    execCounter++;
                    if (execCounter > maxExecCounter) {
                        maxExecCounter = execCounter;
                    }
                    if (ok(tlc)) {
                        ThreadLocals.setContext(tlc);
                    }
                    runnable.run();
                } catch (Exception e) {
                    ExUtil.error(log, "exception in AsyncExec", e);
                } finally {
                    execCounter--;
                    //log.debug("Finished thread: " + Thread.currentThread().getName() + " execCounter="
                    //       + String.valueOf(execCounter) + " maxConcurrency=" + String.valueOf(maxExecCounter));
                }
            }
        });
    }
}
