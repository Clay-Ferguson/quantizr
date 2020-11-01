package org.subnode.model;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import org.springframework.data.annotation.Transient;

public class GraphNode {
    private String id;
    private String name;
    private String path;
    private List<GraphNode> children;
    private HashSet<String> childIds;

    public GraphNode() {
    }

    public GraphNode(String id, String name, String path) {
        this.id = id;
        this.name = name;
        this.path = path;
    }

    public void addChild(GraphNode child) {
        if (childIds != null && childIds.contains(child.getId()))
            return;

        if (children == null) {
            children = new LinkedList<GraphNode>();
        }
        children.add(child);
        if (childIds == null) {
            childIds = new HashSet<String>();
        }
        childIds.add(child.getId());
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
        return childIds;
    }

    public void setChildIds(HashSet<String> childIds) {
        this.childIds = childIds;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }
}
