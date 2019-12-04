package org.subnode.model;

public class GraphEdge {

    private String to;
    private String from;

    public GraphEdge() {
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public GraphEdge(String to, String from) {
        this.setTo(to);
        this.setFrom(from);
    }
}
