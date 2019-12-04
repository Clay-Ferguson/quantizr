package org.subnode.model;

public class GraphNode {
    private String id;
    private String label;

    public GraphNode() {
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public GraphNode(String id, String label) {
        this.id = id;
        this.setLabel(label);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }
}
