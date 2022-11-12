package quanta.util;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import quanta.actpub.APConst;
import quanta.actpub.model.APOTag;
import quanta.actpub.model.APObj;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.NodeAuthFailedException;
import quanta.instrument.PerfMon;
import quanta.model.AccessControlInfo;
import quanta.model.NodeInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.types.TypeBase;

/**
 * Converting objects from one type to another, and formatting.
 */
@Component
public class Convert extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(Convert.class);

	/*
	 * Generates a NodeInfo object, which is the primary data type that is also used on the
	 * browser/client to encapsulate the data for a given node which is used by the browser to render
	 * the node.
	 * 
	 * Note: childrenCheck=true means that we DO need the correct value for hasChildren (from a global,
	 * non-user specific point of view) to be set on this node. Node that we do set hasChildren to true
	 * if there ARE an children REGARDLESS of whether the given user can access those children.
	 */
	@PerfMon(category = "convert")
	public NodeInfo convertToNodeInfo(boolean adminOnly, SessionContext sc, MongoSession ms, SubNode node, boolean initNodeEdit,
			long ordinal, boolean allowInlineChildren, boolean lastChild, boolean childrenCheck, boolean getFollowers,
			boolean loadLikes, boolean attachBoosted, Val<SubNode> boostedNodeVal) {

		String sig = node.getStr(NodeProp.CRYPTO_SIG);

		// if we have a signature, check it.
		boolean sigFail = false;
		if (ok(sig) && !crypto.nodeSigVerify(node, sig)) {
			sigFail = true;
		}

		// #sig: need a config setting that specifies which path(s) are required to be signed so
		// this can be enabled/disabled easily by admin
		if (prop.isRequireCrypto() && node.getPath().startsWith(NodePath.PUBLIC_PATH + "/")) {
			if ((no(sig) || sigFail) && !sc.isAdmin()) {
				// todo-1: we need a special global counter for when this happens, so the server info can show it.
				/*
				 * if we're under the PUBLIC_PATH and a signature fails, don't even show the node if this is an
				 * ordinary user, because this means an 'admin' node is failing it's signature, and is an indication
				 * of a server DB being potentially hacked so we completely refuse to display this content to the
				 * user by returning null here. We only show 'signed' admin nodes to users. If we're logged in as
				 * admin we will be allowed to see even nodes that are failing their signature check, or unsigned.
				 */
				return null;
			}
		}

		// if we know we shold only be including admin node then throw an error if this is not an admin
		// node, but only if we ourselves are not admin.
		if (adminOnly && !acl.isAdminOwned(node) && !sc.isAdmin()) {
			throw new NodeAuthFailedException();
		}

		/* If session user shouldn't be able to see secrets on this node remove them */
		if (ms.isAnon() || (ok(ms.getUserNodeId()) && !ms.getUserNodeId().equals(node.getOwner()))) {
			if (!ms.isAdmin()) {
				node.clearSecretProperties();
			}
		}

		attach.fixAllAttachmentMimes(node);

		boolean hasChildren = read.hasChildren(ms, node, false, childrenCheck);
		List<PropertyInfo> propList = buildPropertyInfoList(sc, node, initNodeEdit, sigFail);
		List<AccessControlInfo> acList = buildAccessControlList(sc, node);

		if (no(node.getOwner())) {
			throw new RuntimeException("node has no owner: " + node.getIdStr() + " node.path=" + node.getPath());
		}

		String ownerId = node.getOwner().toHexString();
		String avatarVer = null;
		String nameProp = null;
		String displayName = null;
		String apAvatar = null;
		String apImage = null;
		String owner = PrincipalName.ADMIN.s();

		/*
		 * todo-1: for endpoints like 'renderNode' we can optimize these calls to get owner nodes all as the
		 * LAST step and get them all (will only be up to 25 at a time) in one single MongoDb "in clause"
		 * type query! But for now this doesn't appear to be a bottleneck so we won't bother.
		 */
		SubNode userNode = read.getOwner(ms, node, false);

		if (ok(userNode)) {
			nameProp = userNode.getStr(NodeProp.USER);

			Attachment userAtt = userNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
			if (ok(userAtt)) {
				avatarVer = userAtt.getBin();
			}
			displayName = userNode.getStr(NodeProp.DISPLAY_NAME);
			apAvatar = userNode.getStr(NodeProp.ACT_PUB_USER_ICON_URL);
			apImage = userNode.getStr(NodeProp.ACT_PUB_USER_IMAGE_URL);
			owner = nameProp;

			/*
			 * todo-2: right here, get user profile off 'userNode', and put it into a map that will be sent back
			 * to client packaged in this response, so that tooltip on the browser can display it, and the
			 * browser will simply contain this same 'map' that maps userIds to profile text, for good
			 * performance.
			 */
		}

		// log.trace("RENDER ID=" + node.getIdStr() + " rootId=" + ownerId + " session.rootId=" +
		// sc.getRootId() + " node.content="
		// + node.getContent() + " owner=" + owner);

		// log.debug("RENDER nodeId: " + node.getIdStr()+" -- json:
		// "+XString.prettyPrint(node));

		/*
		 * If the node is not owned by the person doing the browsing we need to extract the key from ACL and
		 * put in cipherKey, so send back so the user can decrypt the node.
		 */
		String cipherKey = null;
		if (!ownerId.equals(sc.getRootId()) && ok(node.getAc())) {
			AccessControl ac = node.getAc().get(sc.getRootId());
			if (ok(ac)) {
				cipherKey = ac.getKey();
				if (ok(cipherKey)) {
					log.debug("Rendering Sent Back CipherKey: " + cipherKey);
				}
			}
		}

		ArrayList<String> likes = null;
		if (ok(node.getLikes())) {
			likes = new ArrayList<String>(node.getLikes());
		}

		// todo-1: enable this some day....
		// LinkedList<String> likes = null;
		// if (loadLikes && ok(node.getLikes())) {
		// final LinkedList<String> _likes = new LinkedList<>();
		// node.getLikes().forEach(like -> {
		// // I decided not to risk the performance hit this could cause, and will probably load this
		// asynchronously
		// // whenver I do enable this capability in the future. Also for this special case of loading a
		// property
		// // that we might have on a UserNode alrady the we need a way to check first the cache, and THEN
		// the MongoDb
		// // node, BEFORE resorting to making an HTTP REST call like the getActorByUrl currently does.
		// // if (like.startsWith("http://") || like.startsWith("https://")) {
		// // APObj actor = apUtil.getActorByUrl(like);
		// // if (ok(actor)) {
		// // like = apStr(actor, APObj.preferredUsername);
		// // }
		// // }
		// _likes.add(like);
		// });
		// likes = _likes;
		// }

		String content = node.getContent();
		String renderContent = insertExplicitTags(node);

		NodeInfo nodeInfo = new NodeInfo(node.jsonId(), node.getPath(), node.getName(), content, renderContent, //
				node.getTags(), displayName, //
				owner, ownerId, //
				ok(node.getTransferFrom()) ? node.getTransferFrom().toHexString() : null, //
				node.getOrdinal(), //
				node.getModifyTime(), propList, node.getAttachments(), acList, likes, hasChildren, //
				node.getType(), ordinal, lastChild, cipherKey, avatarVer, apAvatar, apImage);

		// if this node type has a plugin run it's converter to let it contribute
		TypeBase plugin = typePluginMgr.getPluginByType(node.getType());
		if (ok(plugin)) {
			plugin.convert(ms, nodeInfo, node, getFollowers);
		}

		if (allowInlineChildren) {
			boolean hasInlineChildren = node.getBool(NodeProp.INLINE_CHILDREN);
			if (hasInlineChildren) {
				Iterable<SubNode> nodeIter = read.getChildren(ms, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), 100, 0);
				Iterator<SubNode> iterator = nodeIter.iterator();
				long inlineOrdinal = 0;
				while (true) {
					if (!iterator.hasNext()) {
						break;
					}
					SubNode n = iterator.next();

					// log.debug("renderNode DUMP[count=" + count + " idx=" +
					// String.valueOf(idx) + " logicalOrdinal=" + String.valueOf(offset
					// + count) + "]: "
					// + XString.prettyPrint(node));

					// NOTE: If this is set to false it then only would allow one level of depth in
					// the 'inlineChildren' capability
					boolean multiLevel = true;

					NodeInfo info = convertToNodeInfo(false, sc, ms, n, initNodeEdit, inlineOrdinal++, multiLevel, lastChild,
							childrenCheck, false, loadLikes, false, null);
					if (ok(info)) {
						nodeInfo.safeGetChildren().add(info);
					}
				}
			}
		}

		if (attachBoosted) {
			SubNode boostedNode = null;

			if (ok(boostedNodeVal)) {
				// if boosted node was passed in use it
				boostedNode = boostedNodeVal.getVal();
			} else {
				// otherwise check to see if we have a boosted node from scratch.
				String boostTargetId = node.getStr(NodeProp.BOOST);
				if (ok(boostTargetId)) {
					boostedNode = read.getNode(ms, boostTargetId);
				}
			}

			if (ok(boostedNode)) {
				NodeInfo info =
						convertToNodeInfo(false, sc, ms, boostedNode, false, 0, false, false, false, false, false, false, null);
				if (ok(info)) {
					nodeInfo.setBoostedNode(info);
				}
			}
		}

		// log.debug("NODEINFO: " + XString.prettyPrint(nodeInfo));
		return nodeInfo;
	}

	/*
	 * reads thru 'content' of node and if there are any "@mentions" that we can render as HTML links
	 * then we insert all those links into the text and return the resultant markdown with the HTML
	 * anchors in it.
	 */
	public static String insertExplicitTags(SubNode node) {

		// don't process foreign-created nodes!
		if (ok(node.getStr(NodeProp.ACT_PUB_ID))) {
			return null;
		}

		HashMap<String, APOTag> mentions = auth.parseMentionsFromNodeProp(node);

		// sending back null for renderContent if no tags were inserted (no special HTML to send back, but
		// just markdown)
		if (no(mentions) || mentions.size() == 0)
			return null;

		StringBuilder sb = new StringBuilder();
		StringTokenizer t = new StringTokenizer(node.getContent(), APConst.TAGS_TOKENIZER, true);

		/*
		 * build the new comma-delimited privs list by adding all that aren't in the setToRemove
		 */
		while (t.hasMoreTokens()) {
			String tok = t.nextToken();
			if (tok.startsWith("@")) {
				APOTag tag = mentions.get(tok);
				if (ok(tag)) {
					// NOTE: The client knows not to render any openGraph panels for anchor tags that have classes
					// 'mention' or 'hashtag' on them
					String href = (String) tag.get(APObj.href);
					if (ok(href)) {
						sb.append("<a class='mention' href='" + href + "'>" + tok + "</a>");
					}
				}
			} else {
				sb.append(tok);
			}
		}
		return sb.toString();
	}

	public static ImageSize getImageSize(Attachment att) {
		ImageSize imageSize = new ImageSize();
		if (ok(att)) {
			try {
				Integer width = att.getWidth();
				if (ok(width)) {
					imageSize.setWidth(width.intValue());
				}

				Integer height = att.getHeight();
				if (ok(height)) {
					imageSize.setHeight(height.intValue());
				}
			} catch (Exception e) {
				imageSize.setWidth(0);
				imageSize.setHeight(0);
			}
		}
		return imageSize;
	}

	public List<PropertyInfo> buildPropertyInfoList(SessionContext sc, SubNode node, //
			boolean initNodeEdit, boolean sigFail) {

		List<PropertyInfo> props = null;
		HashMap<String, Object> propMap = node.getProps();
		if (ok(propMap) && ok(propMap.keySet())) {
			for (String propName : propMap.keySet()) {
				// inticate to the client the signature is no good by not even sending the bad signature to client.
				if (sigFail && NodeProp.CRYPTO_SIG.s().equals(propName)) {
					continue;
				}

				/* lazy create props */
				if (no(props)) {
					props = new LinkedList<>();
				}

				PropertyInfo propInfo = convertToPropertyInfo(sc, node, propName, propMap.get(propName), initNodeEdit);
				// log.debug(" PROP Name: " + propName + " val=" + p.getValue().toString());

				props.add(propInfo);
			}
		}

		if (ok(props)) {
			props.sort((a, b) -> a.getName().compareTo(b.getName()));
		}
		return props;
	}

	public List<AccessControlInfo> buildAccessControlList(SessionContext sc, SubNode node) {
		List<AccessControlInfo> ret = null;
		HashMap<String, AccessControl> ac = node.getAc();
		if (no(ac))
			return null;

		for (Map.Entry<String, AccessControl> entry : ac.entrySet()) {
			String principalId = entry.getKey();
			AccessControl acval = entry.getValue();

			/* lazy create list */
			if (no(ret)) {
				ret = new LinkedList<>();
			}

			AccessControlInfo acInfo = convertToAccessControlInfo(sc, node, principalId, acval);
			ret.add(acInfo);
		}

		return ret;
	}

	public AccessControlInfo convertToAccessControlInfo(SessionContext sc, SubNode node, String principalId, AccessControl ac) {
		AccessControlInfo acInfo = new AccessControlInfo();
		acInfo.setPrincipalNodeId(principalId);

		if (ok(ac.getPrvs()) && ac.getPrvs().contains(PrivilegeType.READ.s())) {
			acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.READ.s()));
		}

		if (ok(ac.getPrvs()) && ac.getPrvs().contains(PrivilegeType.WRITE.s())) {
			acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.WRITE.s()));
		}

		if (ok(principalId)) {
			arun.run(s -> {
				// todo-1: if the actual user account has been delete we can get here and end up with null user name
				// I think. Look into it.
				acInfo.setPrincipalName(auth.getAccountPropById(s, principalId, NodeProp.USER.s()));
				acInfo.setDisplayName(auth.getAccountPropById(s, principalId, NodeProp.DISPLAY_NAME.s()));

				// currently don't ever need this info for displaying rows, so don't waste the
				// CPU cycles to get it.
				// if (!"public".equals(principalId)) {
				// SubNode accountNode = read.getNode(s, principalId);
				// if (ok(accountNode )) {
				// acInfo.setAvatarVer(accountNode.getStrProp(NodeProp.BIN));
				// }
				// }
				return null;
			});
		}
		return acInfo;
	}

	public PropertyInfo convertToPropertyInfo(SessionContext sc, SubNode node, String propName, Object prop,
			boolean initNodeEdit) {
		try {
			Object value = null;
			switch (propName) {
				case "content":
					value = formatValue(sc, prop, /* false, */ initNodeEdit);
					break;

				// Special processing (need to build this kind of stuff into the "Plugin" architecture for types)
				case "ap:tag": // NodeProp.ACT_PUB_TAG
					value = prop;
					break;

				default:
					value = prop.toString();
					break;
			}

			/* log.trace(String.format("prop[%s]=%s", prop.getName(), value)); */
			PropertyInfo propInfo = new PropertyInfo(propName, value);
			return propInfo;
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	public String basicTextFormatting(String val) {
		val = val.replace("\n\r", "<p>");
		val = val.replace("\n", "<p>");
		val = val.replace("\r", "<p>");
		return val;
	}

	public String formatValue(SessionContext sc, Object value, /* boolean convertToHtml, */ boolean initNodeEdit) {
		try {
			if (value instanceof Date) {
				return DateUtil.formatTimeForUserTimezone((Date) value, sc.getTimezone(), sc.getTimeZoneAbbrev());
			} else {
				String ret = value.toString();

				/*
				 * If we are doing an initNodeEdit we don't do this, because we want the text to render to the user
				 * exactly as they had typed it and not with links converted.
				 */
				if (!initNodeEdit) {
					ret = convertLinksToMarkdown(ret);
				}

				return ret;
			}
		} catch (Exception e) {
			return "";
		}
	}

	/**
	 * Searches in 'val' anywhere there is a line that begins with http:// (or https), and replaces that
	 * with the normal way of doing a link in markdown. So we are injecting a snippet of markdown (not
	 * html)
	 */
	public static String convertLinksToMarkdown(String val) {
		while (true) {
			/* find http after newline character */
			int startOfLink = val.indexOf("\nhttp://");

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\rhttp://");
			}

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\nhttps://");
			}

			/* or else find one after return char */
			if (startOfLink == -1) {
				startOfLink = val.indexOf("\rhttps://");
			}

			/* nothing found we're all done here */
			if (startOfLink == -1)
				break;

			/*
			 * locate end of link via \n or \r
			 */
			int endOfLink = val.indexOf("\n", startOfLink + 1);
			if (endOfLink == -1) {
				endOfLink = val.indexOf("\r", startOfLink + 1);
			}
			if (endOfLink == -1) {
				endOfLink = val.length();
			}

			String link = val.substring(startOfLink + 1, endOfLink);

			String left = val.substring(0, startOfLink + 1);
			String right = val.substring(endOfLink);
			val = left + "[" + link + "](" + link + ")" + right;
		}
		return val;
	}
}
