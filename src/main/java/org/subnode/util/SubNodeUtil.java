package org.subnode.util;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import org.subnode.model.client.NodeProp;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropertyMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Assorted general utility functions related to SubNodes.
 * 
 * todo-2: there's a lot of code calling these static methods, but need to
 * transition to singleton scope bean and non-static methods.
 */
@Component
public class SubNodeUtil {
	private static final Logger log = LoggerFactory.getLogger(SubNodeUtil.class);

	/*
	 * number of hex digits to use from the SHA256 string, and in general needs to
	 * only guarantee uniquess inside a single node (sibling uniqueness) so this can
	 * be kinda short.
	 */
	public static final int PATH_HASH_LEN = 7;

	@Autowired
	private MongoApi api;

	/*
	 * These are properties we should never allow the client to send back as part of
	 * a save operation.
	 */
	private static HashSet<String> nonSavableProperties = new HashSet<String>();

	static {
		nonSavableProperties.add(NodeProp.BIN.s());
		nonSavableProperties.add(NodeProp.BIN_TOTAL.s());
		nonSavableProperties.add(NodeProp.BIN_QUOTA.s());
	}

	/*
	 * Currently there's a bug in the client code where it sends nulls for some
	 * nonsavable types, so before even fixing the client I decided to just make the
	 * server side block those. This is more secure to always have the server allow
	 * misbehaving javascript for security reasons.
	 */
	public static boolean isSavableProperty(String propertyName) {
		return !nonSavableProperties.contains(propertyName);
	}

	public boolean hasDisplayableNodes(MongoSession session, boolean isAdvancedEditingMode, SubNode node) {
		return (api.getChildCount(session, node) > 0);
	}

	//todo-1: everywhere this is called can we be sure the path is not actually used as a lookup, but instead the node name?
	//The new design has path as a non-named hierarchy-only aspect.
	public SubNode ensureNodeExists(MongoSession session, String parentPath, String name, String defaultContent,
			String primaryTypeName, boolean saveImmediate, SubNodePropertyMap props, ValContainer<Boolean> created) {
		if (!parentPath.endsWith("/")) {
			parentPath += "/";
		}

		// log.debug("Looking up node by path: "+(parentPath+name));
		SubNode node = api.getNode(session, fixPath(parentPath + name));
		if (node != null) {
			if (created != null) {
				created.setVal(false);
			}
			return node;
		}

		if (created != null) {
			created.setVal(true);
		}

		List<String> nameTokens = XString.tokenize(name, "/", true);
		if (nameTokens == null) {
			return null;
		}

		SubNode parent = null;

		if (!parentPath.equals("/")) {
			parent = api.getNode(session, parentPath);
			if (parent == null) {
				throw ExUtil.wrapEx("Expected parent not found: " + parentPath);
			}
		}

		boolean nodesCreated = false;
		for (String nameToken : nameTokens) {

			String path = fixPath(parentPath + nameToken);
			// log.debug("ensuring node exists: parentPath=" + path);
			node = api.getNode(session, path);

			/*
			 * if this node is found continue on, using it as current parent to build on
			 */
			if (node != null) {
				parent = node;
			} else {
				// log.debug("Creating " + nameToken + " node, which didn't exist.");

				/* Note if parent PARAMETER here is null we are adding a root node */
				parent = api.createNode(session, parent, nameToken, primaryTypeName, 0L, CreateNodeLocation.LAST, null);

				if (parent == null) {
					throw ExUtil.wrapEx("unable to create " + nameToken);
				}
				nodesCreated = true;

				if (defaultContent == null) {
					parent.setContent("");
				}
				api.save(session, parent);
			}
			parentPath += nameToken + "/";
		}

		if (defaultContent != null) {
			parent.setContent(defaultContent);
		}

		if (props != null) {
			parent.addProperties(props);
		}

		if (saveImmediate && nodesCreated) {
			api.saveSession(session);
		}
		return parent;
	}

	public static String fixPath(String path) {
		return path.replace("//", "/");
	}

	/*
	 * I've decided 64 bits of randomness is good enough, instead of 128, thus we
	 * are dicing up the string to use every other character. If you want to modify
	 * this method to return a full UUID that will not cause any problems, other
	 * than default node names being the full string, which is kind of long
	 */
	public String getGUID() {
		String uid = UUID.randomUUID().toString();
		StringBuilder sb = new StringBuilder();
		int len = uid.length();

		/* chop length in half by using every other character */
		for (int i = 0; i < len; i += 2) {
			char c = uid.charAt(i);
			if (c == '-') {
				i--;
			} else {
				sb.append(c);
			}
		}

		return sb.toString();

		// WARNING: I remember there are some cases where SecureRandom can hang on
		// non-user machines
		// (i.e. production servers), as
		// they rely no some OS level sources of entropy that may be dormant at the
		// time. Be
		// careful.
		// here's another way to generate a random 64bit number...
		// if (prng == null) {
		// prng = SecureRandom.getInstance("SHA1PRNG");
		// }
		//
		// return String.valueOf(prng.nextLong());
	}
}
