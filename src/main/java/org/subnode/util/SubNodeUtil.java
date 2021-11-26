package org.subnode.util;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.AppController;
import org.subnode.config.AppProp;
import org.subnode.model.NodeMetaInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropertyMap;
import org.subnode.service.NodeRenderService;

/**
 * Assorted general utility functions related to SubNodes.
 * 
 * todo-2: there's a lot of code calling these static methods, but need to transition to singleton
 * scope bean and non-static methods.
 */
@Component
public class SubNodeUtil {
	private static final Logger log = LoggerFactory.getLogger(SubNodeUtil.class);

	@Autowired
	private NodeRenderService nodeRender;

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private AppProp appProp;

	/*
	 * These are properties we should never allow the client to send back as part of a save operation.
	 */
	private static HashSet<String> nonSavableProperties = new HashSet<>();

	static {
		nonSavableProperties.add(NodeProp.BIN.s());
		nonSavableProperties.add(NodeProp.BIN_TOTAL.s());
		nonSavableProperties.add(NodeProp.BIN_QUOTA.s());
	}

	public HashMap<String, AccessControl> cloneAcl(SubNode node) {
		if (node.getAc() == null)
			return null;
		return new HashMap<String, AccessControl>(node.getAc());
	}

	/*
	 * Currently there's a bug in the client code where it sends nulls for some nonsavable types, so
	 * before even fixing the client I decided to just make the server side block those. This is more
	 * secure to always have the server allow misbehaving javascript for security reasons.
	 */
	public static boolean isSavableProperty(String propertyName) {
		return !nonSavableProperties.contains(propertyName);
	}

	public void setNodePublicWritable(SubNode node) {
		HashMap<String, AccessControl> ac = new HashMap<>();
		ac.put(PrincipalName.PUBLIC.s(), new AccessControl(null, PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s()));
		node.setAc(ac);
	}

	public String getFriendlyNodeUrl(MongoSession ms, SubNode node) {
		// if node doesn't thave a name, make ID-based url
		if (StringUtils.isEmpty(node.getName())) {
			return String.format("%s/app?id=%s", appProp.getHostAndPort(), node.getIdStr());
		}
		// else format this node name based on whether the node is admin owned or not.
		else {
			String owner = read.getNodeOwner(ms, node);

			// if admin owns node
			if (owner.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
				return String.format("%s/n/%s", appProp.getHostAndPort(), node.getName());
			}
			// if non-admin owns node
			else {
				return String.format("%s/u/%s/%s", appProp.getHostAndPort(), owner, node.getName());
			}
		}
	}

	/**
	 * Ensures a node at parentPath/pathName exists and that it's also named 'nodeName' (if nodeName is
	 * provides), by creating said node if not already existing or leaving it as is if it does exist.
	 */
	public SubNode ensureNodeExists(MongoSession ms, String parentPath, String pathName, String nodeName,
			String defaultContent, String primaryTypeName, boolean saveImmediate, SubNodePropertyMap props,
			ValContainer<Boolean> created) {

		if (nodeName != null) {
			SubNode nodeByName = read.getNodeByName(ms, nodeName);
			if (nodeByName != null) {
				return nodeByName;
			}
		}

		if (!parentPath.endsWith("/")) {
			parentPath += "/";
		}

		// log.debug("Looking up node by path: "+(parentPath+name));
		SubNode node = read.getNode(ms, fixPath(parentPath + pathName));

		// if we found the node and it's name matches (if provided)
		if (node != null && (nodeName == null || nodeName.equals(node.getName()))) {
			if (created != null) {
				created.setVal(false);
			}
			return node;
		}

		if (created != null) {
			created.setVal(true);
		}

		List<String> nameTokens = XString.tokenize(pathName, "/", true);
		if (nameTokens == null) {
			return null;
		}

		SubNode parent = null;
		if (!parentPath.equals("/")) {
			parent = read.getNode(ms, parentPath);
			if (parent == null) {
				throw ExUtil.wrapEx("Expected parent not found: " + parentPath);
			}
		}

		boolean nodesCreated = false;
		for (String nameToken : nameTokens) {

			String path = fixPath(parentPath + nameToken);
			// log.debug("ensuring node exists: parentPath=" + path);
			node = read.getNode(ms, path);

			/*
			 * if this node is found continue on, using it as current parent to build on
			 */
			if (node != null) {
				parent = node;
			} else {
				// log.debug("Creating " + nameToken + " node, which didn't exist.");

				/* Note if parent PARAMETER here is null we are adding a root node */
				parent = create.createNode(ms, parent, nameToken, primaryTypeName, 0L, CreateNodeLocation.LAST, null, null,
						true);

				if (parent == null) {
					throw ExUtil.wrapEx("unable to create " + nameToken);
				}
				nodesCreated = true;

				if (defaultContent == null) {
					parent.setContent("");
					parent.touch();
				}
				update.save(ms, parent);
			}
			parentPath += nameToken + "/";
		}

		if (nodeName != null) {
			parent.setName(nodeName);
		}

		if (defaultContent != null) {
			parent.setContent(defaultContent);
			parent.touch();
		}

		if (props != null) {
			parent.addProperties(props);
		}

		if (saveImmediate && nodesCreated) {
			update.saveSession(ms);
		}
		return parent;
	}

	public static String fixPath(String path) {
		return path.replace("//", "/");
	}

	public String getExportFileName(String fileName, SubNode node) {
		if (!StringUtils.isEmpty(fileName)) {
			// truncate any file name extension.
			fileName = XString.truncateAfterLast(fileName, ".");
			return fileName;
		} else if (node.getName() != null) {
			return node.getName();
		} else {
			return "f" + getGUID();
		}
	}

	/*
	 * I've decided 64 bits of randomness is good enough, instead of 128, thus we are dicing up the
	 * string to use every other character. If you want to modify this method to return a full UUID that
	 * will not cause any problems, other than default node names being the full string, which is kind
	 * of long
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

		/*
		 * WARNING: I remember there are some cases where SecureRandom can hang on non-user machines (i.e.
		 * production servers), as they rely no some OS level sources of entropy that may be dormant at the
		 * time. Be careful. here's another way to generate a random 64bit number...
		 */
		// if (prng == null) {
		// prng = SecureRandom.getInstance("SHA1PRNG");
		// }
		//
		// return String.valueOf(prng.nextLong());
	}

	public NodeMetaInfo getNodeMetaInfo(SubNode node) {
		if (node == null)
			return null;
		NodeMetaInfo ret = new NodeMetaInfo();

		String description = node.getContent();
		if (description == null) {
			if (node.getName() != null) {
				description = "Node Name: " + node.getName();
			} else {
				description = "Node ID: " + node.getIdStr();
			}
		}

		int newLineIdx = description.indexOf("\n");
		if (newLineIdx != -1) {
			// call this once to start just so the title extraction works.
			description = nodeRender.stripRenderTags(description);

			// get the new idx, it might have changed.
			newLineIdx = description.indexOf("\n");

			String ogTitle = description.substring(0, newLineIdx).trim();
			ogTitle = nodeRender.stripRenderTags(ogTitle);
			ret.setTitle(ogTitle);

			description = description.substring(newLineIdx).trim();
			description = nodeRender.stripRenderTags(description);
			ret.setDescription(description);
		} else {
			ret.setTitle("Quanta");
			description = nodeRender.stripRenderTags(description);
			ret.setDescription(description);
		}

		String url = getAttachmentUrl(node);
		String mime = node.getStrProp(NodeProp.BIN_MIME.s());

		if (url == null) {
			url = appProp.getHostAndPort() + "/branding/logo-200px-tr.jpg";
			mime = "image/jpeg";
		}

		ret.setAttachmentUrl(url);
		ret.setAttachmentMime(mime);
		ret.setUrl(appProp.getHostAndPort() + "/app?id=" + node.getIdStr());
		return ret;
	}

	public String getAttachmentUrl(SubNode node) {
		String ipfsLink = node.getStrProp(NodeProp.IPFS_LINK);

		String bin = ipfsLink != null ? ipfsLink : node.getStrProp(NodeProp.BIN);
		if (bin != null) {
			return appProp.getHostAndPort() + AppController.API_PATH + "/bin/" + bin + "?nodeId=" + node.getIdStr();
		}

		/* as last resort try to get any extrnally linked binary image */
		if (bin == null) {
			bin = node.getStrProp(NodeProp.BIN_URL);
		}

		// todo-1: will this fail to find "data:" type inline image data?
		return bin;
	}

	public String getIdBasedUrl(SubNode node) {
		return appProp.getProtocolHostAndPort() + "/app?id=" + node.getIdStr();
	}
}
