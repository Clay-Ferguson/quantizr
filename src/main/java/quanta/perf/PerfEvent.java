package quanta.perf;

public class PerfEvent implements AutoCloseable {
    public static final int CAPTURE_THRESHOLD = 1000; // 10ms

    // NO GETTERS/SETTERS. Not needed or wanted.
    public long duration;
    public String event;
    public String user;
    public long startTime;

    // Pass event as 'null' to start a chaining set of event timings, where this constructor
    // doesn't represent processing done, but the beginning of a set of operations
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
