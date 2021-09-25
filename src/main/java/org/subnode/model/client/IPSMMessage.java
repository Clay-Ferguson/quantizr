package org.subnode.model.client;

import java.util.List;

public class IPSMMessage {
    private String from;
    private String sig;
    private List<IPSMData> content;
    private long ts;

    public long getTs() {
        return ts;
    }

    public void setTs(long ts) {
        this.ts = ts;
    }

    public List<IPSMData> getContent() {
        return content;
    }

    public void setContent(List<IPSMData> content) {
        this.content = content;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getSig() {
        return sig;
    }

    public void setSig(String sig) {
        this.sig = sig;
    }
}
