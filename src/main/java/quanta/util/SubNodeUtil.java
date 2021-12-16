package quanta.util;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.AppController;
import quanta.config.AppProp;
import quanta.model.NodeMetaInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.mongo.model.SubNodePropertyMap;
import quanta.service.NodeRenderService;

import static quanta.util.Util.*;

/**
 * Assorted general utility functions related to SubNodes.
 * 
 * todo-2: there's a lot of code calling these static methods, but need to transition to singleton
 * scope bean and non-static methods.
 */
@Lazy @Component
public class SubNodeUtil  {
	private static final Logger log = LoggerFactory.getLogger(SubNodeUtil.class);

	@Autowired
	@Lazy
	protected NodeRenderService render;

	@Autowired
	@Lazy
	protected AppProp prop;

	@Autowired
	@Lazy
	protected MongoUpdate update;

	@Autowired
	@Lazy
	protected MongoRead read;

	@Autowired
	@Lazy
	protected MongoCreate create;

	/*
	 * These are properties we should never allow the client to send back as part of a save operation.
	 */
	private static HashSet<String> nonSavableProperties = new HashSet<>();

	static {
		nonSavableProperties.add(NodeProp.BIN.s());
		nonSavableProperties.add(NodeProp.BIN_TOTAL.s());
		nonSavableProperties.add(NodeProp.BIN_QUOTA.s());
	}

	public void removeUnwantedPropsForIPFS(SubNode node) {
		node.delete(NodeProp.IPFS_CID.s());
	}

	/*
	 * For properties that are being set to their default behaviors as if the property didn't exist
	 * (such as vertical layout is assumed if no layout property is specified) we remove those
	 * properties when the client is passing them in to be saved, or from any other source they are
	 * being passed to be saved
	 */
	public void removeDefaultProps(SubNode node) {

		/* If layout=="v" then remove the property */
		String layout = node.getStr(NodeProp.LAYOUT.s());
		if ("v".equals(layout)) {
			node.delete(NodeProp.LAYOUT.s());
		}

		/* If layout=="v" then remove the property */
		String childrenImageSizes = node.getStr(NodeProp.CHILDREN_IMG_SIZES.s());
		if ("n".equals(childrenImageSizes)) {
			node.delete(NodeProp.CHILDREN_IMG_SIZES.s());
		}

		/* If priority=="0" then remove the property */
		String priority = node.getStr(NodeProp.PRIORITY.s());
		if ("0".equals(priority)) {
			node.delete(NodeProp.PRIORITY.s());
		}

		if (ok(node.getProperties()) && node.getProperties().size() == 0) {
			node.setProperties(null);
		}
	}

	public HashMap<String, AccessControl> cloneAcl(SubNode node) {
		if (no(node.getAc()))
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
			return String.format("%s/app?id=%s", prop.getHostAndPort(), node.getIdStr());
		}
		// else format this node name based on whether the node is admin owned or not.
		else {
			String owner = read.getNodeOwner(ms, node);

			// if admin owns node
			if (owner.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
				return String.format("%s/n/%s", prop.getHostAndPort(), node.getName());
			}
			// if non-admin owns node
			else {
				return String.format("%s/u/%s/%s", prop.getHostAndPort(), owner, node.getName());
			}
		}
	}

	/**
	 * Ensures a node at parentPath/pathName exists and that it's also named 'nodeName' (if nodeName is
	 * provides), by creating said node if not already existing or leaving it as is if it does exist.
	 */
	public SubNode ensureNodeExists(MongoSession ms, String parentPath, String pathName, String nodeName, String defaultContent,
			String primaryTypeName, boolean saveImmediate, SubNodePropertyMap props, Val<Boolean> created) {

		if (ok(nodeName)) {
			SubNode nodeByName = read.getNodeByName(ms, nodeName);
			if (ok(nodeByName)) {
				return nodeByName;
			}
		}

		if (!parentPath.endsWith("/")) {
			parentPath += "/";
		}

		// log.debug("Looking up node by path: "+(parentPath+name));
		SubNode node = read.getNode(ms, fixPath(parentPath + pathName));

		// if we found the node and it's name matches (if provided)
		if (ok(node) && (no(nodeName) || nodeName.equals(node.getName()))) {
			if (ok(created)) {
				created.setVal(false);
			}
			return node;
		}

		if (ok(created)) {
			created.setVal(true);
		}

		List<String> nameTokens = XString.tokenize(pathName, "/", true);
		if (no(nameTokens)) {
			return null;
		}

		SubNode parent = null;
		if (!parentPath.equals("/")) {
			parent = read.getNode(ms, parentPath);
			if (no(parent)) {
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
			if (ok(node)) {
				parent = node;
			} else {
				// log.debug("Creating " + nameToken + " node, which didn't exist.");

				/* Note if parent PARAMETER here is null we are adding a root node */
				parent = create.createNode(ms, parent, nameToken, primaryTypeName, 0L, CreateNodeLocation.LAST, null, null, true);

				if (no(parent)) {
					throw ExUtil.wrapEx("unable to create " + nameToken);
				}
				nodesCreated = true;

				if (no(defaultContent)) {
					parent.setContent("");
					parent.touch();
				}
				update.save(ms, parent);
			}
			parentPath += nameToken + "/";
		}

		if (ok(nodeName)) {
			parent.setName(nodeName);
		}

		if (ok(defaultContent)) {
			parent.setContent(defaultContent);
			parent.touch();
		}

		if (ok(props)) {
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
		} else if (ok(node.getName())) {
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
		// if (no(prng )) {
		// prng = SecureRandom.getInstance("SHA1PRNG");
		// }
		//
		// return String.valueOf(prng.nextLong());
	}

	public NodeMetaInfo getNodeMetaInfo(SubNode node) {
		if (no(node))
			return null;
		NodeMetaInfo ret = new NodeMetaInfo();

		String description = node.getContent();
		if (no(description)) {
			if (ok(node.getName())) {
				description = "Node Name: " + node.getName();
			} else {
				description = "Node ID: " + node.getIdStr();
			}
		}

		int newLineIdx = description.indexOf("\n");
		if (newLineIdx != -1) {
			// call this once to start just so the title extraction works.
			description = render.stripRenderTags(description);

			// get the new idx, it might have changed.
			newLineIdx = description.indexOf("\n");

			String ogTitle = description.substring(0, newLineIdx).trim();
			ogTitle = render.stripRenderTags(ogTitle);
			ret.setTitle(ogTitle);

			description = description.substring(newLineIdx).trim();
			description = render.stripRenderTags(description);
			ret.setDescription(description);
		} else {
			ret.setTitle("Quanta");
			description = render.stripRenderTags(description);
			ret.setDescription(description);
		}

		String url = getAttachmentUrl(node);
		String mime = node.getStr(NodeProp.BIN_MIME.s());

		if (no(url)) {
			url = prop.getHostAndPort() + "/branding/logo-200px-tr.jpg";
			mime = "image/jpeg";
		}

		ret.setAttachmentUrl(url);
		ret.setAttachmentMime(mime);
		ret.setUrl(prop.getHostAndPort() + "/app?id=" + node.getIdStr());
		return ret;
	}

	public String getAttachmentUrl(SubNode node) {
		String ipfsLink = node.getStr(NodeProp.IPFS_LINK);

		String bin = ok(ipfsLink) ? ipfsLink : node.getStr(NodeProp.BIN);
		if (ok(bin)) {
			return prop.getHostAndPort() + AppController.API_PATH + "/bin/" + bin + "?nodeId=" + node.getIdStr();
		}

		/* as last resort try to get any extrnally linked binary image */
		if (no(bin)) {
			bin = node.getStr(NodeProp.BIN_URL);
		}

		// todo-1: will this fail to find "data:" type inline image data?
		return bin;
	}

	public String getIdBasedUrl(SubNode node) {
		return prop.getProtocolHostAndPort() + "/app?id=" + node.getIdStr();
	}
}
