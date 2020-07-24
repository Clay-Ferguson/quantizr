package org.subnode.mongo;

import java.util.Date;

import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.UserFeedService;
import org.subnode.util.Util;
import org.subnode.util.XString;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.AfterLoadEvent;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;

public class MongoEventListener extends AbstractMongoEventListener<SubNode> {

	private static final Logger log = LoggerFactory.getLogger(MongoEventListener.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private UserFeedService userFeedService;

	@Autowired
	private SessionContext sessionContext;

	/*
	 * todo-2: This is a temporary hack to allow our ExportJsonService.resetNode
	 * importer to work. This is importing nodes that should be all self contained
	 * as a directed graph and there's no risk if nodes without parents, but they
	 * MAY be out of order so that the children of some nodes may appear in the JSON
	 * being imported BEFORE their parents (which would cause the parent check to
	 * fail, up until the full node graph has been imported), and so I'm creating
	 * this hack to globally disable the check during the import only.
	 */
	public static boolean parentCheckEnabled = false;

	/**
	 * What we are doing in this method is assigning the ObjectId ourselves, because
	 * our path must include this id at the very end, since the path itself must be
	 * unique. So we assign this prior to persisting so that when we persist
	 * everything is perfect.
	 * 
	 * WARNING: updating properties on 'node' in here has NO EFFECT. Always update
	 * dbObj only!
	 */
	@Override
	public void onBeforeSave(BeforeSaveEvent<SubNode> event) {
		// log.debug("MONGO SAVE EVENT.");
		SubNode node = event.getSource();

		Document dbObj = event.getDocument();
		ObjectId id = node.getId();

		/*
		 * Note: There's a special case in MongoApi#createUser where the new User root
		 * node ID is assigned there, along with setting that on the owner property so
		 * we can do one save and have both updated
		 */
		if (id == null) {
			id = new ObjectId();
			node.setId(id);
			// log.debug("New Node ID generated: " + id);
		}
		dbObj.put(SubNode.FIELD_ID, id);

		// log.debug("onBeforeSave: ID: " + node.getId().toHexString());

		// DO NOT DELETE
		// If we ever add a unique-index for "Name" (not currently the case), then we'd
		// need something like this to be sure
		// each node WOULD have a unique name.
		// if (StringUtils.isEmpty(node.getName())) {
		// node.setName(id.toHexString())
		// }

		/* if no owner is assigned... */
		if (node.getOwner() == null) {

			/* if we are saving the root node, we make it be the owner of itself */
			if (node.getPath().equals("/" + NodeName.ROOT)) {
				dbObj.put(SubNode.FIELD_OWNER, id);
				node.setOwner(id);
			}
			/* otherwise we have a problem, because we require an owner always */
			else {
				throw new RuntimeEx("Attempted to save node with no owner: " + XString.prettyPrint(node));
			}
		}

		if (parentCheckEnabled) {
			api.checkParentExists(null, node);
		}

		/*
		 * New nodes can be given a path where they will allow the ID to play the role
		 * of the leaf 'name' part of the path
		 */
		if (node.getPath().endsWith("/?")) {
			String shortId = Util.getHashOfString(id.toHexString(), 10);
			String path = XString.removeLastChar(node.getPath()) + shortId;
			dbObj.put(SubNode.FIELD_PATH, path);
			node.setPath(path);
		}

		String pathHash = Util.getHashOfString(node.getPath(), 14);
		// log.debug("CHECK PathHash=" + pathHash);

		if (!pathHash.equals(node.getPathHash())) {
			dbObj.put(SubNode.FIELD_PATH_HASH, pathHash);
			node.setPathHash(pathHash);
			log.debug("RESET PathHash=" + pathHash);
		}

		/* Node name not allowed to contain : or ~ */
		String nodeName = node.getName();
		if (nodeName != null) {

			nodeName = nodeName.replaceAll(":", "-");
			nodeName = nodeName.replaceAll("~", "-");
			nodeName = nodeName.replaceAll("/", "-");

			// Warning: this is not a redundant null check. Some code in this block CAN set
			// to null.
			if (nodeName != null) {
				dbObj.put(SubNode.FIELD_NAME, nodeName);
				node.setName(nodeName);
			}
		}

		removeDefaultProps(node);

		if (node.isDeleted()) {
			userFeedService.nodeDeleteNotify(node.getId().toHexString());
		}
	}

	/*
	 * For properties that are being set to their default behaviors as if the
	 * property didn't exist (such as vertical layout is assumed if no layout
	 * property is specified) we remove those properties when the client is passing
	 * them in to be saved, or from any other source they are being passed to be
	 * saved
	 */
	public void removeDefaultProps(SubNode node) {

		/* If layout=="v" then remove the property */
		String layout = node.getStringProp(NodeProp.LAYOUT.s());
		if ("v".equals(layout)) {
			node.deleteProp(NodeProp.LAYOUT.s());
		}

		/* If priority=="0" then remove the property */
		String priority = node.getStringProp(NodeProp.PRIORITY.s());
		if ("0".equals(priority)) {
			node.deleteProp(NodeProp.PRIORITY.s());
		}
	}

	@Override
	public void onAfterSave(AfterSaveEvent<SubNode> event) {
		// SubNode node = event.getSource();
	}

	@Override
	public void onAfterLoad(AfterLoadEvent<SubNode> event) {
		// Document dbObj = event.getDocument();
		// log.debug("onAfterLoad:
		// id="+dbObj.getObjectId(SubNode.FIELD_ID).toHexString());
	}

	@Override
	public void onAfterConvert(AfterConvertEvent<SubNode> event) {
		// Document dbObj = event.getDocument();
		// ObjectId id = dbObj.getObjectId(SubNode.FIELD_ID);
	}

	@Override
	public void onBeforeDelete(BeforeDeleteEvent<SubNode> event) {
		Document doc = event.getDocument();
		if (doc != null) {
			Object val = doc.get("_id");
			if (val instanceof ObjectId) {
				userFeedService.nodeDeleteNotify(((ObjectId) val).toHexString());
			}
		}
	}
}
