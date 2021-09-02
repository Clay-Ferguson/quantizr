package org.subnode.util;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/*
 * Warning do not call this run method from INSIDE this class. Due to the spring proxy 'issue' you
 * can't do that
 */
@Component
public class AsyncExec {
    /*
     * *** DO NOT DELETE *** This is left here as an example of what NOT TO DO. Because of the way
     * Spring Annotated methods use the 'proxy' interface (i.e. like AOP) if you call an annotated
     * method from another method INSIDE the same class, the annotation gets ignored, because in that
     * case it goes around the proxy (not calling thru proxy) and therefore the method below will FAIL
     * by executing the @Async SYNCHRONOUSLY in the same thread. Note that the exception that can be
     * thrown based by checking threadId is also protecting us against this mistake.
     */
    // public void run(Runnable runnable) {
    // run(ThreadLocals.getContext(), runnable);
    // }

    // WARNING: This thread (all methods called of course) needs to avoid attempting to get
    // SessionContext autowiring or access ThreadLocals from the request thread so....
    // todo-0: Should we STOP ever autowiring SessionContext and always stuff that into thread-locals in
    // the webfilter instead
    // todo-0: setting the ThreadLocal in this thread should work, just pass from the calling thread.
    @Async("threadPoolTaskExecutor")
    public void run(ThreadLocalsContext tlc, Runnable runnable) {

        /*
         * if the currently executing threadId is the same as the one from the passed in 'tlc' we definitely
         * have a bug, and the @Async annotation is not having an effect.
         */
        if (Thread.currentThread().getId() == tlc.threadId) {
            throw new RuntimeException("AsyncExec ran running synchronously!");
        }
        ThreadLocals.setContext(tlc);
        runnable.run();
    }
}
