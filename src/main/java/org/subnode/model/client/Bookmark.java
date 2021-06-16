package org.subnode.model.client;

public class Bookmark {
    private String name;
    private String id;
    private String selfId;
    
    public String getSelfId() {
        return selfId;
    }
    public void setSelfId(String selfId) {
        this.selfId = selfId;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getId() {
        return id;
    }
    public void setId(String id) {
        this.id = id;
    }
}
