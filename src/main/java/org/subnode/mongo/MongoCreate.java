package org.subnode.mongo;

import java.util.List;

import org.springframework.data.mongodb.core.query.Criteria;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.model.PropertyInfo;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.model.SubNode;

@Component
public class MongoCreate {
	private static final Logger log = LoggerFactory.getLogger(MongoCreate.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoAuth auth;

	public SubNode createNode(MongoSession session, SubNode parent, String type, Long ordinal,
			CreateNodeLocation location, boolean updateParentOrdinals) {
		return createNode(session, parent, null, type, ordinal, location, null, null, updateParentOrdinals);
	}

	public SubNode createNode(MongoSession session, String path) {
		ObjectId ownerId = read.getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, NodeType.NONE.s(), null);
		return node;
	}

	public SubNode createNode(MongoSession session, String path, String type) {
		if (type == null) {
			type = NodeType.NONE.s();
		}
		ObjectId ownerId = read.getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, type, null);
		return node;
	}

	public SubNode createNodeAsOwner(MongoSession session, String path, String type, ObjectId ownerId) {
		if (type == null) {
			type = NodeType.NONE.s();
		}
		// ObjectId ownerId = read.getOwnerNodeIdFromSession(session);
		SubNode node = new SubNode(ownerId, path, type, null);
		return node;
	}

	/*
	 * Creates a node, but does NOT persist it. If parent==null it assumes it's
	 * adding a root node. This is required, because all the nodes at the root level
	 * have no parent. That is, there is no ROOT node. Only nodes considered to be
	 * on the root.
	 * 
	 * relPath can be null if no path is known
	 */
	public SubNode createNode(MongoSession session, SubNode parent, String relPath, String type, Long ordinal,
			CreateNodeLocation location, List<PropertyInfo> properties, ObjectId ownerId,
			boolean updateParentOrdinals) {
		if (relPath == null) {
			/*
			 * Adding a node ending in '?' will trigger for the system to generate a leaf
			 * node automatically.
			 */
			relPath = "?";
		}

		if (type == null) {
			type = NodeType.NONE.s();
		}

		String path = (parent == null ? "" : parent.getPath()) + "/" + relPath;

		if (ownerId == null) {
			ownerId = read.getOwnerNodeIdFromSession(session);
		}

		// for now not worried about ordinals for root nodes.
		if (parent == null) {
			ordinal = 0L;
		} else {
			if (updateParentOrdinals) {
				if (ordinal == null) {
					ordinal = 0L;
				}
				ordinal = prepOrdinalForLocation(session, location, parent, ordinal);
			}
		}

		SubNode node = new SubNode(ownerId, path, type, ordinal);

		if (properties != null) {
			for (PropertyInfo propInfo : properties) {
				node.setProp(propInfo.getName(), propInfo.getValue());
			}
		}

		return node;
	}

	private Long prepOrdinalForLocation(MongoSession session, CreateNodeLocation location, SubNode parent,
			Long ordinal) {
		switch (location) {
		case FIRST:
			ordinal = 0L;
			insertOrdinal(session, parent, 0L, 1L);
			break;
		case LAST:
			ordinal = read.getMaxChildOrdinal(session, parent) + 1;
			parent.setMaxChildOrdinal(ordinal);
			break;
		case ORDINAL:
			insertOrdinal(session, parent, ordinal, 1L);
			break;
		default:
			throw new RuntimeException("Unknown ordinal");
		}

		update.saveSession(session);
		return ordinal;
	}

	/*
	 * Shifts all child ordinals down (increments them by rangeSize), that are >=
	 * 'ordinal' to make a slot for the new ordinal positions for some new nodes to
	 * be inserted into this newly available range of unused sequential ordinal
	 * values (range of 'ordinal+1' thru 'ordinal+1+rangeSize')
	 */
	public void insertOrdinal(MongoSession session, SubNode node, long ordinal, long rangeSize) {
		long maxOrdinal = 0;

		auth.auth(session, node, PrivilegeType.READ);
		Criteria criteria = Criteria.where(SubNode.FIELD_ORDINAL).gte(ordinal);
		log.debug("insertOrdinal GTE " + ordinal);
		for (SubNode child : read.getChildrenUnderParentPath(session, node.getPath(), null, null, 0, null, criteria)) {
			long o = child.getOrdinal() == null ? 0L : child.getOrdinal().longValue();
			o += rangeSize;
			child.setOrdinal(o);

			if (o > maxOrdinal) {
				maxOrdinal = o;
			}
		}

		/*
		 * even in the boundary case where there were no existing children, it's ok to
		 * set this node value to zero here
		 */
		node.setMaxChildOrdinal(maxOrdinal);
	}
}