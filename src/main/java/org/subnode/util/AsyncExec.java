package org.subnode.util;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/* Warning do not call this run method from INSIDE this class. Due to the spring proxy 'issue' you can't do that */
@Component
public class AsyncExec {

    /*
     * For now we can run each 'runnable' in it's own thread just the way
     * spring @Async was designed but I can also envision later converting this into
     * a Queue container that lets a single other thread just eat away at the queue
     * always in ONE single dedicated thread, which may cause less contention and be
     * more 'healthy' use of system resources, because the only reason we have async
     * capability is so that the REST endpoints can return as fast as possible and
     * queue any async functions that can be done in the background, so a single
     * queue and background thread can accomplish this potentially better with less
     * thread contention, by running async queued functions sequentially in that
     * thread.
     */
    @Async("threadPoolTaskExecutor")
    public void run(Runnable runnable) {
        runnable.run();
    }
}
