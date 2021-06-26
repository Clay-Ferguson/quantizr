package org.subnode.util;

import java.net.URLConnection;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.config.SessionContext;
import org.subnode.model.AccessControlInfo;
import org.subnode.model.NodeInfo;
import org.subnode.model.PrivilegeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.mongo.model.SubNodePropertyMap;
import org.subnode.service.AttachmentService;

/**
 * Converting objects from one type to another, and formatting.
 */
@Component
public class Convert {
	@Autowired
	private MongoUtil util;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private RunAsMongoAdminEx adminRunner;

	private static final Logger log = LoggerFactory.getLogger(Convert.class);

	/*
	 * Generates a NodeInfo object, which is the primary data type that is also used on the
	 * browser/client to encapsulate the data for a given node which is used by the browser to render
	 * the node
	 */
	public NodeInfo convertToNodeInfo(SessionContext sessionContext, MongoSession session, SubNode node, boolean htmlOnly,
			boolean initNodeEdit, long ordinal, boolean allowInlineChildren, boolean lastChild) {

		if (node.getOwner() == null) {
			throw new RuntimeException("node has no owner: id=" + node.getId().toHexString());
		}

		/* If session user shouldn't be able to see secrets on this node remove them */
		if (session.isAnon() || (session.getUserNodeId() != null && !session.getUserNodeId().equals(node.getOwner()))) {
			if (!session.isAdmin()) {
				node.clearSecretProperties();
			}
		}

		ImageSize imageSize = null;
		String dataUrl = null;
		String mimeType = node.getStrProp(NodeProp.BIN_MIME.s());
		if (mimeType != null) {
			boolean isImage = util.isImageAttached(node);

			if (isImage) {
				imageSize = util.getImageSize(node);

				String dataUrlProp = node.getStrProp(NodeProp.BIN_DATA_URL.s());
				if (dataUrlProp != null) {
					dataUrl = attachmentService.getStringByNode(session, node);

					// sanity check here.
					if (!dataUrl.startsWith("data:")) {
						dataUrl = null;
					}
				}
			}
		}

		// ensure we have the best mimeType we can if not set in the data.
		if (StringUtils.isEmpty(mimeType)) {
			String binUrl = node.getStrProp(NodeProp.BIN_URL.s());
			if (!StringUtils.isEmpty(binUrl)) {
				mimeType = URLConnection.guessContentTypeFromName(binUrl);
				if (!StringUtils.isEmpty(mimeType)) {
					node.setProp(NodeProp.BIN_MIME.s(), mimeType);
				}
			}
		}

		boolean hasChildren = read.hasChildren(session, node);
		// log.trace("hasNodes=" + hasChildren + " node: "+node.getId().toHexString());

		List<PropertyInfo> propList = buildPropertyInfoList(sessionContext, node, htmlOnly, initNodeEdit);
		List<AccessControlInfo> acList = buildAccessControlList(sessionContext, node);

		String ownerId = node.getOwner().toHexString();
		String avatarVer = null;

		/*
		 * todo-2: this is a spot that can be optimized. We should be able to send just the userNodeId back
		 * to client, and the client should be able to deal with that (i think). depends on how much
		 * ownership info we need to show user.
		 */
		String nameProp = null;
		SubNode userNode = read.getNode(session, node.getOwner(), false);
		String displayName = null;

		if (userNode == null) {
			// todo-1: looks like import corrupts the 'owner' (needs research), but the code
			// below sets to owner to 'admin' which will
			// be safe for now because the admin is the only user capable of import/export.
			// log.debug("Unable to find userNode from nodeOwner: " + //
			// (node.getOwner() != null ? ownerId : ("null owner on node: " +
			// node.getId().toHexString())) + //
			// " tried to find owner=" + node.getOwner().toHexString());
		} else {
			nameProp = userNode.getStrProp(NodeProp.USER.s());
			avatarVer = userNode.getStrProp(NodeProp.BIN.s());
			displayName = userNode.getStrProp(NodeProp.DISPLAY_NAME.s());

			/*
			 * todo-1: right here, get user profile off 'userNode', and put it into a map that will be sent back
			 * to client packaged in this response, so that tooltip on the browser can display it, and the
			 * browser will simply contain this same 'map' that maps userIds to profile text, for good
			 * performance.
			 */
		}

		String owner = userNode == null ? PrincipalName.ADMIN.s() : nameProp;

		log.trace("RENDER ID=" + node.getId().toHexString() + " rootId=" + ownerId + " session.rootId="
				+ sessionContext.getRootId() + " node.content=" + node.getContent() + " owner=" + owner);

		// log.debug("RENDER nodeId: " + node.getId().toHexString()+" -- json:
		// "+XString.prettyPrint(node));

		/*
		 * If the node is not owned by the person doing the browsing we need to extract the key from ACL and
		 * put in cipherKey, so send back so the user can decrypt the node.
		 */
		String cipherKey = null;
		if (!ownerId.equals(sessionContext.getRootId()) && node.getAc() != null) {
			AccessControl ac = node.getAc().get(sessionContext.getRootId());
			if (ac != null) {
				cipherKey = ac.getKey();
				if (cipherKey != null) {
					log.debug("Rendering Sent Back CipherKey: " + cipherKey);
				}
			}
		}

		String apAvatar = userNode != null ? userNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL) : null;
		String apImage = userNode != null ? userNode.getStrProp(NodeProp.ACT_PUB_USER_IMAGE_URL) : null;

		NodeInfo nodeInfo = new NodeInfo(node.jsonId(), node.getPath(), node.getName(), node.getContent(), displayName, owner,
				ownerId, node.getOrdinal(), //
				node.getModifyTime(), propList, acList, hasChildren, //
				imageSize != null ? imageSize.getWidth() : 0, //
				imageSize != null ? imageSize.getHeight() : 0, //
				node.getType(), ordinal, lastChild, cipherKey, dataUrl, avatarVer, apAvatar, apImage);

		/*
		 * Special case for "Friend" type nodes, to get enough information for the browser to be able to
		 * render the avatar and the bio of the person. Eventually we need to remove this kind of
		 * type-specific tight-coupling from here and make some kind of plugin (like client has) for hooking
		 * into this kind of type-specific logic
		 */
		if (node.getType().equals(NodeType.FRIEND.s())) {

			String userUrl = node.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
			if (userUrl != null) {
				nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_ACTOR_URL.s(), userUrl));
			}

			String friendAccountId = node.getStrProp(NodeProp.USER_NODE_ID);
			// log.debug("friendAccountId=" + friendAccountId + " on nodeId=" + node.getId().toHexString());

			/*
			 * NOTE: Right when the Friend node is first created, before a person has been selected, this WILL
			 * be null, and is normal
			 */
			if (friendAccountId != null) {
				SubNode friendAccountNode = read.getNode(session, friendAccountId, false);

				/*
				 * to load up a friend node for the browser to display, we have to populate these "Client Props", on
				 * the node object which are not properties of the node itself but values we generate right here on
				 * demand. The "Client Props" is a completely different set than the actual node properties
				 */
				if (friendAccountNode != null) {
					/* NOTE: This will be the bio for both ActivityPub users and local users */
					String userBio = friendAccountNode.getStrProp(NodeProp.USER_BIO.s());
					if (userBio != null) {
						nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.USER_BIO.s(), userBio));
					}

					userUrl = friendAccountNode.getStrProp(NodeProp.ACT_PUB_ACTOR_URL.s());
					if (userUrl != null) {
						nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_ACTOR_URL.s(), userUrl));
					}

					String friendAvatarVer = friendAccountNode.getStrProp(NodeProp.BIN.s());
					if (friendAvatarVer != null) {
						nodeInfo.safeGetClientProps().add(new PropertyInfo("avatarVer", friendAvatarVer));
					}

					String friendDisplayName = friendAccountNode.getStrProp(NodeProp.DISPLAY_NAME.s());
					if (friendDisplayName != null) {
						nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.DISPLAY_NAME.s(), friendDisplayName));
					}

					/*
					 * Note: for ActivityPub foreign users we have this property on their account node that points to
					 * the live URL of their account avatar as it was found in their Actor object
					 */

					String userIconUrl = friendAccountNode.getStrProp(NodeProp.ACT_PUB_USER_ICON_URL.s());
					if (userIconUrl != null) {
						nodeInfo.safeGetClientProps().add(new PropertyInfo(NodeProp.ACT_PUB_USER_ICON_URL.s(), userIconUrl));
					}

					// todo-1: for now the client isn't rendering the header image so there's no ACT_PUB_USER_IMAGE_URL
					// right here which is how we can do that at some point in the future maybe.
				}
			}
		}

		if (allowInlineChildren) {
			boolean hasInlineChildren = node.getBooleanProp(NodeProp.INLINE_CHILDREN.s());
			if (hasInlineChildren) {
				Iterable<SubNode> nodeIter =
						read.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), 100, 0);
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

					nodeInfo.safeGetChildren().add(convertToNodeInfo(sessionContext, session, n, htmlOnly, initNodeEdit,
							inlineOrdinal++, multiLevel, lastChild));
				}
			}
		}
		// log.debug("NODEINFO: " + XString.prettyPrint(nodeInfo));
		return nodeInfo;
	}

	public static ImageSize getImageSize(SubNode node) {
		ImageSize imageSize = new ImageSize();

		try {
			Long width = node.getIntProp(NodeProp.IMG_WIDTH.s());
			if (width != null) {
				imageSize.setWidth(width.intValue());
			}

			Long height = node.getIntProp(NodeProp.IMG_HEIGHT.s());
			if (height != null) {
				imageSize.setHeight(height.intValue());
			}
		} catch (Exception e) {
			imageSize.setWidth(0);
			imageSize.setHeight(0);
		}
		return imageSize;
	}

	public List<PropertyInfo> buildPropertyInfoList(SessionContext sessionContext, SubNode node, //
			boolean htmlOnly, boolean initNodeEdit) {

		List<PropertyInfo> props = null;
		SubNodePropertyMap propMap = node.getProperties();

		for (Map.Entry<String, SubNodePropVal> entry : propMap.entrySet()) {
			String propName = entry.getKey();
			SubNodePropVal p = entry.getValue();

			/* lazy create props */
			if (props == null) {
				props = new LinkedList<>();
			}

			PropertyInfo propInfo = convertToPropertyInfo(sessionContext, node, propName, p, htmlOnly, initNodeEdit);
			// log.debug(" PROP Name: " + propName + " val=" + p.getValue().toString());

			props.add(propInfo);
		}

		if (props != null) {
			props.sort((a, b) -> a.getName().compareTo(b.getName()));
		}
		return props;
	}

	public List<AccessControlInfo> buildAccessControlList(SessionContext sessionContext, SubNode node) {
		List<AccessControlInfo> ret = null;
		HashMap<String, AccessControl> ac = node.getAc();
		if (ac == null)
			return null;

		for (Map.Entry<String, AccessControl> entry : ac.entrySet()) {
			String principalId = entry.getKey();
			AccessControl acval = entry.getValue();

			/* lazy create list */
			if (ret == null) {
				ret = new LinkedList<>();
			}

			AccessControlInfo acInfo = convertToAccessControlInfo(sessionContext, node, principalId, acval);
			ret.add(acInfo);
		}

		return ret;
	}

	public AccessControlInfo convertToAccessControlInfo(SessionContext sessioContext, SubNode node, String principalId,
			AccessControl ac) {
		AccessControlInfo acInfo = new AccessControlInfo();
		acInfo.setPrincipalNodeId(principalId);

		if (ac.getPrvs() != null && ac.getPrvs().contains(PrivilegeType.READ.s())) {
			acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.READ.s()));
		}

		if (ac.getPrvs() != null && ac.getPrvs().contains(PrivilegeType.WRITE.s())) {
			acInfo.addPrivilege(new PrivilegeInfo(PrivilegeType.WRITE.s()));
		}

		if (principalId != null) {
			adminRunner.run(s -> {
				acInfo.setPrincipalName(auth.getUserNameFromAccountNodeId(s, principalId));
				acInfo.setDisplayName(auth.getDisplayNameFromAccountNodeId(s, principalId));

				// currently don't ever need this info for displaying rows, so don't waste the
				// CPU cycles to get it.
				// if (!"public".equals(principalId)) {
				// SubNode accountNode = read.getNode(s, principalId);
				// if (accountNode != null) {
				// acInfo.setAvatarVer(accountNode.getStrProp(NodeProp.BIN));
				// }
				// }
				return null;
			});
		}
		return acInfo;
	}

	public PropertyInfo convertToPropertyInfo(SessionContext sessionContext, SubNode node, String propName, SubNodePropVal prop,
			boolean htmlOnly, boolean initNodeEdit) {
		try {
			String value = "content".equals(propName) ? formatValue(sessionContext, prop.getValue(), false, initNodeEdit)
					: prop.getValue().toString();
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

	public String formatValue(SessionContext sessionContext, Object value, boolean convertToHtml, boolean initNodeEdit) {
		try {
			if (value instanceof Date) {
				return sessionContext.formatTimeForUserTimezone((Date) value);
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
	 * 
	 * todo-1: I noticed this method gets called during the 'saveNode' processing and then is called
	 * again when the server refreshes the whole page. This is something that is a slight bit of wasted
	 * processing.
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
