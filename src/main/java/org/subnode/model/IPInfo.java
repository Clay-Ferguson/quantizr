package org.subnode.model;

public class IPInfo {
    private Object lock = new Object();
    private long lastRequestTime;

    public Object getLock() {
        return lock;
    }
    public void setLock(Object lock) {
        this.lock = lock;
    }
    public long getLastRequestTime() {
        return lastRequestTime;
    }
    public void setLastRequestTime(long lastRequestTime) {
        this.lastRequestTime = lastRequestTime;
    }
}
