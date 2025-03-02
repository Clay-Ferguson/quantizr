package quanta.perf;

/**
 * Performance event tracking class that implements AutoCloseable for use with try-with-resources.
 */
public class PerfEvent implements AutoCloseable {
    public static final int CAPTURE_THRESHOLD = 1000; /* 1000ms (1 second) */

    /* NO GETTERS/SETTERS. Not needed or wanted. */
    public long duration;
    public String event;
    public String user;
    public long startTime;

    /**
     * Pass event as 'null' to start a chaining set of event timings, where this constructor doesn't
     * represent processing done, but the beginning of a set of operations.
     * 
     * WARNING: If you see examples of creating this object and then not using it, that's normal because
     * the use of it is in the 'try-with-resources' block, which will call 'close()' on this object when
     * the block is exited.
     */
    public PerfEvent(String event, String user) {
        this.user = user;
        this.event = event;
        startTime = System.currentTimeMillis();
    }

    @Override
    public void close() throws Exception {
        duration = System.currentTimeMillis() - startTime;
        if (duration > CAPTURE_THRESHOLD) {
            PerfData.add(this);
        }
    }
}
