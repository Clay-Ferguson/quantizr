package org.subnode.model;

import java.util.Date;

import org.bson.types.ObjectId;
import org.subnode.mongo.model.SubNode;

/* Holds the nodeId and modTime of a recent post to a user's Outbox */
public class UserFeedItem {
    private ObjectId nodeId;
    private Date modTime;
    private String userName;

    /* Until we have 1000s of users we can get away with saving the actual node here, and it will be extremely
    easy to stop actually storing the node here (to save memory) at some point in the future. For now we just do what's 
    the very simplest. No pre-mature optimization. */
    private SubNode node;

    public ObjectId getNodeId() {
        return nodeId;
    }

    public void setNodeId(ObjectId nodeId) {
        this.nodeId = nodeId;
    }

    public Date getModTime() {
        return modTime;
    }

    public void setModTime(Date modTime) {
        this.modTime = modTime;
    }

    public SubNode getNode() {
        return node;
    }

    public void setNode(SubNode node) {
        this.node = node;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }
}