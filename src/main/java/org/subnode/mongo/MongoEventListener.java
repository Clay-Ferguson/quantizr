package org.subnode.mongo;

import java.util.Date;
import java.util.HashMap;

import org.subnode.config.NodeName;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.types.AllSubNodeTypes;
import org.subnode.util.Util;
import org.subnode.util.XString;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;

public class MongoEventListener extends AbstractMongoEventListener<SubNode> {

	private static final Logger log = LoggerFactory.getLogger(MongoEventListener.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private AllSubNodeTypes TYPES;

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
		SubNode node = event.getSource();
		node.setWriting(true);

		Document dbObj = event.getDocument();
		ObjectId id = node.getId();

		if (id == null) {
			id = new ObjectId();
			node.setId(id);
			// log.debug("New Node ID generated: " + id);
		}
		dbObj.put(SubNode.FIELD_ID, id);

		log.debug("onBeforeSave: ID: " + node.getId().toHexString());

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
				throw new RuntimeException("Attempted to save node with no owner: " + XString.prettyPrint(node));
			}
		}

		if (parentCheckEnabled) {
			api.checkParentExists(node);
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

		Date now = new Date();
		if (node.getCreateTime() == null) {
			dbObj.put(SubNode.FIELD_CREATE_TIME, now);
			node.setCreateTime(now);
		}

		if (node.isUpdateModTimeOnSave()) {
			dbObj.put(SubNode.FIELD_MODIFY_TIME, now);
			node.setModifyTime(now);
		}

		/* We are converting ACL into AC here 
		This code has been completed (ran on all instances already)
		*/
		// if (node.getAcl() != null) {
		// 	HashMap<String, AccessControl> acMap = new HashMap<String, AccessControl>();
		// 	node.getAcl().forEach((k, v) -> {
		// 		AccessControl ac = new AccessControl();
		// 		// log.debug("Setting ac with k=" + k + " v=" + v + " for node: " + node.getId().toHexString());
		// 		ac.setPrvs(v);
		// 		acMap.put(k, ac);
		// 	});
		// 	dbObj.put(SubNode.FIELD_AC, acMap);
		// 	node.setAc(acMap);
		// }
	}

	@Override
	public void onAfterSave(AfterSaveEvent<SubNode> event) {
		SubNode node = event.getSource();
		node.setWriting(false);
	}

	// @Override
	// public void onAfterDelete(AfterDeleteEvent<SubNode> event) {
	// SubNode node = event.getSource();
	// node.setWriting(false);
	// }
}
