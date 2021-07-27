package org.subnode.util;

public class StopwatchEntry {
    private int duration;
    private String event;
    private String threadName;

    public StopwatchEntry(String event, int duration, String threadName) {
        this.event = event;
        this.duration = duration;
        this.threadName = threadName;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public String getThreadName() {
        return threadName;
    }

    public void setThreadName(String threadName) {
        this.threadName = threadName;
    }
}
