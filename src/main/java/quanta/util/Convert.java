package quanta.util;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
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
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import quanta.config.SessionContext;
import quanta.model.AccessControlInfo;
import quanta.model.NodeInfo;
import quanta.model.PrivilegeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.mongo.model.SubNodePropVal;
import quanta.mongo.model.SubNodePropertyMap;
import quanta.service.AttachmentService;
import quanta.types.TypeBase;
import quanta.types.TypePluginMgr;

/**
 * Converting objects from one type to another, and formatting.
 */
@Lazy
@Component
public class Convert {
	private static final Logger log = LoggerFactory.getLogger(Convert.class);

	@Autowired
	@Lazy
	protected TypePluginMgr typePluginMgr;

	@Autowired
	@Lazy
	protected AttachmentService attach;

	@Autowired
	@Lazy
	protected AdminRun arun;

	@Autowired
	@Lazy
	protected MongoUtil mongoUtil;

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoRead read;

	/*
	 * Generates a NodeInfo object, which is the primary data type that is also used on the
	 * browser/client to encapsulate the data for a given node which is used by the browser to render
	 * the node.
	 */
	public NodeInfo convertToNodeInfo(SessionContext sc, MongoSession ms, SubNode node, boolean htmlOnly, boolean initNodeEdit,
			long ordinal, boolean allowInlineChildren, boolean lastChild, boolean childrenCheck, boolean getFollowers) {

		/* If session user shouldn't be able to see secrets on this node remove them */
		if (ms.isAnon() || (ok(ms.getUserNodeId()) && !ms.getUserNodeId().equals(node.getOwner()))) {
			if (!ms.isAdmin()) {
				node.clearSecretProperties();
			}
		}

		ImageSize imageSize = null;
		String dataUrl = null;
		String mimeType = node.getStr(NodeProp.BIN_MIME.s());
		if (ok(mimeType)) {
			boolean isImage = mongoUtil.isImageAttached(node);

			if (isImage) {
				imageSize = mongoUtil.getImageSize(node);

				String dataUrlProp = node.getStr(NodeProp.BIN_DATA_URL.s());
				if (ok(dataUrlProp)) {
					dataUrl = attach.getStringByNode(ms, node);

					// sanity check here.
					if (!dataUrl.startsWith("data:")) {
						dataUrl = null;
					}
				}
			}
		}

		// ensure we have the best mimeType we can if not set in the data.
		if (StringUtils.isEmpty(mimeType)) {
			String binUrl = node.getStr(NodeProp.BIN_URL.s());
			if (!StringUtils.isEmpty(binUrl)) {
				mimeType = URLConnection.guessContentTypeFromName(binUrl);
				if (!StringUtils.isEmpty(mimeType)) {
					node.set(NodeProp.BIN_MIME.s(), mimeType);
				}
			}
		}

		boolean hasChildren = childrenCheck ? read.hasChildren(ms, node) : false;
		// log.trace("hasNodes=" + hasChildren + " node: "+node.getIdStr());

		List<PropertyInfo> propList = buildPropertyInfoList(sc, node, htmlOnly, initNodeEdit);
		List<AccessControlInfo> acList = buildAccessControlList(sc, node);

		if (no(node.getOwner())) {
			throw new RuntimeException("node has no owner: " + node.getIdStr() + " node.path=" + node.getPath());
		}

		String ownerId = node.getOwner().toHexString();
		String avatarVer = null;

		/*
		 * todo-2: this is a spot that can be optimized. We should be able to send just the userNodeId back
		 * to client, and the client should be able to deal with that (i think). depends on how much
		 * ownership info we need to show user.
		 */
		String nameProp = null;
		SubNode userNode = read.getNode(ms, node.getOwner(), false);
		String displayName = null;

		if (no(userNode)) {
			// todo-1: looks like import corrupts the 'owner' (needs research), but the code
			// below sets to owner to 'admin' which will
			// be safe for now because the admin is the only user capable of import/export.
			// log.debug("Unable to find userNode from nodeOwner: " + //
			// (ok(node.getOwner()) ? ownerId : ("null owner on node: " +
			// node.getIdStr())) + //
			// " tried to find owner=" + node.getOwner().toHexString());
		} else {
			nameProp = userNode.getStr(NodeProp.USER.s());
			avatarVer = userNode.getStr(NodeProp.BIN.s());
			displayName = userNode.getStr(NodeProp.DISPLAY_NAME.s());

			/*
			 * todo-1: right here, get user profile off 'userNode', and put it into a map that will be sent back
			 * to client packaged in this response, so that tooltip on the browser can display it, and the
			 * browser will simply contain this same 'map' that maps userIds to profile text, for good
			 * performance.
			 */
		}

		String owner = no(userNode) ? PrincipalName.ADMIN.s() : nameProp;

		log.trace("RENDER ID=" + node.getIdStr() + " rootId=" + ownerId + " session.rootId=" + sc.getRootId() + " node.content="
				+ node.getContent() + " owner=" + owner);

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

		String apAvatar = ok(userNode) ? userNode.getStr(NodeProp.ACT_PUB_USER_ICON_URL) : null;
		String apImage = ok(userNode) ? userNode.getStr(NodeProp.ACT_PUB_USER_IMAGE_URL) : null;

		NodeInfo nodeInfo = new NodeInfo(node.jsonId(), node.getPath(), node.getName(), node.getContent(), displayName, owner,
				ownerId, node.getOrdinal(), //
				node.getModifyTime(), propList, acList, hasChildren, //
				ok(imageSize) ? imageSize.getWidth() : 0, //
				ok(imageSize) ? imageSize.getHeight() : 0, //
				node.getType(), ordinal, lastChild, cipherKey, dataUrl, avatarVer, apAvatar, apImage);

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

					nodeInfo.safeGetChildren().add(convertToNodeInfo(sc, ms, n, htmlOnly, initNodeEdit, inlineOrdinal++,
							multiLevel, lastChild, childrenCheck, false));
				}
			}
		}
		// log.debug("NODEINFO: " + XString.prettyPrint(nodeInfo));
		return nodeInfo;
	}

	public static ImageSize getImageSize(SubNode node) {
		ImageSize imageSize = new ImageSize();

		try {
			Long width = node.getInt(NodeProp.IMG_WIDTH);
			if (ok(width)) {
				imageSize.setWidth(width.intValue());
			}

			Long height = node.getInt(NodeProp.IMG_HEIGHT);
			if (ok(height)) {
				imageSize.setHeight(height.intValue());
			}
		} catch (Exception e) {
			imageSize.setWidth(0);
			imageSize.setHeight(0);
		}
		return imageSize;
	}

	public List<PropertyInfo> buildPropertyInfoList(SessionContext sc, SubNode node, //
			boolean htmlOnly, boolean initNodeEdit) {

		List<PropertyInfo> props = null;
		SubNodePropertyMap propMap = node.getProperties();

		for (Map.Entry<String, SubNodePropVal> entry : propMap.entrySet()) {
			String propName = entry.getKey();
			SubNodePropVal p = entry.getValue();

			/* lazy create props */
			if (no(props)) {
				props = new LinkedList<>();
			}

			PropertyInfo propInfo = convertToPropertyInfo(sc, node, propName, p, htmlOnly, initNodeEdit);
			// log.debug(" PROP Name: " + propName + " val=" + p.getValue().toString());

			props.add(propInfo);
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

	public PropertyInfo convertToPropertyInfo(SessionContext sc, SubNode node, String propName, SubNodePropVal prop,
			boolean htmlOnly, boolean initNodeEdit) {
		try {
			String value = "content".equals(propName) ? formatValue(sc, prop.getValue(), false, initNodeEdit)
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

	public String formatValue(SessionContext sc, Object value, boolean convertToHtml, boolean initNodeEdit) {
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
