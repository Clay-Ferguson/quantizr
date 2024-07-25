package quanta.util;

import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

/** 
 * WARNING:
 * For @Async to work it needs to be in it's own component class, or the AOP proxying won't work.
 */
@Component
public class AsyncLayer extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AsyncLayer.class);

    @Async
    public CompletableFuture<Void> run(Runnable runnable) {
        runnable.run();
        return CompletableFuture.completedFuture(null);
    }
}
