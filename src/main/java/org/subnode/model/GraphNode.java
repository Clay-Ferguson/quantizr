package org.subnode.model;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import org.springframework.data.annotation.Transient;

public class GraphNode {
    private String name;
    private String path;
    private List<GraphNode> children;
    private HashSet<String> childNames; 

    public GraphNode() {
    }

    public GraphNode(String name) {
        this.name = name;
    }

    public void addChild(GraphNode child) {
        if (childNames!=null && childNames.contains(child.getName())) return;

        if (children == null) {
            children = new LinkedList<GraphNode>();
        }
        children.add(child);
        if (childNames == null) {
            childNames = new HashSet<String>();
        }
        childNames.add(child.getName());
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<GraphNode> getChildren() {
        return children;
    }

    public void setChildren(List<GraphNode> children) {
        this.children = children;
    }

    @Transient
    @JsonIgnore
    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    @Transient
    @JsonIgnore
    public HashSet<String> getChildIds() {
        return childNames;
    }

    public void setChildIds(HashSet<String> childIds) {
        this.childNames = childIds;
    }
}
