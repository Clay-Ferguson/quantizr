package org.subnode.types;

import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

public abstract class TypeBase {

    public abstract String getName();
    public abstract void convert(MongoSession session, NodeInfo nodeInfo, SubNode node, boolean getFollowers);
}
