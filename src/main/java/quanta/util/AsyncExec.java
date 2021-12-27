package quanta.util;

import static quanta.util.Util.ok;
import java.util.concurrent.Executor;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

/*
 * Encapsulates any thread runs we need which need "ThreadLocals.setContext(tlc);"
 */
@Component
public class AsyncExec extends ServiceBase {

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    public Executor executor;

    @PostConstruct
    public void postConstruct() {
        asyncExec = this;
    }

    // Async seems to be tricky to configure after recent changes. It just doesn't work, so we just use
    // 'executor.execute' instead.
    // @Async("threadPoolTaskExecutor")
    public void run(ThreadLocalsContext tlc, Runnable runnable) {
        executor.execute(new Runnable() {
            public void run() {
                if (ok(tlc)) {
                    /*
                     * if the currently executing threadId is the same as the one from the passed in 'tlc' we definitely
                     * have a bug, and the @Async annotation is not having an effect.
                     */
                    if (Thread.currentThread().getId() == tlc.threadId) {
                        throw new RuntimeException("AsyncExec ran synchronously! @Async got ignored.");
                    }
                    ThreadLocals.setContext(tlc);
                }
                runnable.run();
            }
        });
    }
}
