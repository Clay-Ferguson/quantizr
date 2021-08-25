package org.subnode.types;

import org.subnode.model.NodeInfo;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.CreateSubNodeRequest;
import org.subnode.util.ValContainer;

public abstract class TypeBase {

    public abstract String getName();

    public void convert(MongoSession session, NodeInfo nodeInfo, SubNode node, boolean getFollowers) {}

    public void createSubNode(MongoSession session, ValContainer<SubNode> node, CreateSubNodeRequest req, boolean linkBookmark) {}
}
