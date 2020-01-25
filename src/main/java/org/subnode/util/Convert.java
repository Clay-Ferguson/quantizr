package org.subnode.util;

import java.util.Collections;
import java.util.Date;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import org.subnode.config.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.image.ImageSize;
import org.subnode.model.NodeInfo;
import org.subnode.model.PropertyInfo;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.mongo.model.SubNodePropertyMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/**
 * Converting objects from one type to another, and formatting.
 */
@Component
public class Convert {
	@Autowired
	private MongoApi api;

	public static final PropertyInfoComparator propertyInfoComparator = new PropertyInfoComparator();

	private static final Logger log = LoggerFactory.getLogger(Convert.class);

	/*
	 * Generates a NodeInfo object, which is the primary data type that is also used
	 * on the browser/client to encapsulate the data for a given node which is used
	 * by the browser to render the node
	 */
	public NodeInfo convertToNodeInfo(SessionContext sessionContext, MongoSession session, SubNode node,
			boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit, long logicalOrdinal,
			boolean allowInlineChildren, boolean firstChild, boolean lastChild) {
		boolean hasBinary = false;
		boolean binaryIsImage = false;
		ImageSize imageSize = null;

		long binVer = node.getIntProp(NodeProp.BIN_VER);
		String mimeType = node.getStringProp(NodeProp.BIN_MIME);
		if (mimeType != null) {
			hasBinary = true;
			binaryIsImage = api.isImageAttached(node);

			if (binaryIsImage) {
				imageSize = api.getImageSize(node);
			}
		}

		//UserPreferences userPreferences = sessionContext.getUserPreferences();
		//boolean advancedMode = userPreferences != null ? userPreferences.isAdvancedMode() : false;
		boolean hasNodes = (api.getChildCount(node) > 0);
		// log.trace("hasNodes=" + hasNodes + " path=" + node.getPath());

		List<PropertyInfo> propList = buildPropertyInfoList(sessionContext, node, htmlOnly, allowAbbreviated,
				initNodeEdit);

		/*
		 * todo-2: this is a spot that can be optimized. We should be able to send just
		 * the userNodeId back to client, and the client should be able to deal with
		 * that (i think). depends on how much ownership info we need to show user.
		 */
		SubNode userNode = api.getNode(session, node.getOwner(), false);
		String owner = userNode == null ? "?" : userNode.getStringProp(NodeProp.USER);

		NodeInfo nodeInfo = new NodeInfo(node.jsonId(), node.getPath(), node.getName(), node.getContent(), owner, node.getOrdinal(), //
				node.getModifyTime(), propList, hasNodes, hasBinary, binaryIsImage, binVer, //
				imageSize != null ? imageSize.getWidth() : 0, //
				imageSize != null ? imageSize.getHeight() : 0, //
				node.getType(), logicalOrdinal, firstChild, lastChild);

		if (allowInlineChildren) {
			boolean hasInlineChildren = node.getBooleanProp("inlineChildren");
			if (hasInlineChildren) {
				Iterable<SubNode> nodeIter = api.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), 100);
				Iterator<SubNode> iterator = nodeIter.iterator();

				while (true) {
					if (!iterator.hasNext()) {
						break;
					}
					SubNode n = iterator.next();

					if (nodeInfo.getChildren() == null) {
						nodeInfo.setChildren(new LinkedList<NodeInfo>());
					}
					// log.debug("renderNode DUMP[count=" + count + " idx=" +
					// String.valueOf(idx) + " logicalOrdinal=" + String.valueOf(offset
					// + count) + "]: "
					// + XString.prettyPrint(node));

					nodeInfo.getChildren().add(convertToNodeInfo(sessionContext, session, n, htmlOnly, allowAbbreviated,
							initNodeEdit, logicalOrdinal, false, firstChild, lastChild));
				}
			}
		}
		return nodeInfo;
	}

	public static ImageSize getImageSize(SubNode node) {
		ImageSize imageSize = new ImageSize();

		try {
			Long width = node.getIntProp(NodeProp.IMG_WIDTH);
			if (width != null) {
				imageSize.setWidth(width.intValue());
			}

			Long height = node.getIntProp(NodeProp.IMG_HEIGHT);
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
			boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit) {
		
		List<PropertyInfo> props = null;
		SubNodePropertyMap propMap = node.getProperties();

		for (Map.Entry<String, SubNodePropVal> entry : propMap.entrySet()) {
			String propName = entry.getKey();
			SubNodePropVal p = entry.getValue();

			/* lazy create props */
			if (props == null) {
				props = new LinkedList<PropertyInfo>();
			}

			PropertyInfo propInfo = convertToPropertyInfo(sessionContext, node, propName, p, htmlOnly, allowAbbreviated,
					initNodeEdit);
			// log.debug(" PROP Name: " + propName + " val=" + p.getValue().toString());

			props.add(propInfo);
		}

		if (props != null) {
			Collections.sort(props, propertyInfoComparator);
		}
		return props;
	}

	public PropertyInfo convertToPropertyInfo(SessionContext sessionContext, SubNode node, String propName,
			SubNodePropVal prop, boolean htmlOnly, boolean allowAbbreviated, boolean initNodeEdit) {
		try {
			String value = null;
			boolean abbreviated = false;

			value = formatValue(sessionContext, prop.getValue(), false, initNodeEdit);
			/* log.trace(String.format("prop[%s]=%s", prop.getName(), value)); */

			PropertyInfo propInfo = new PropertyInfo(propName, value, abbreviated);
			return propInfo;
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	public String basicTextFormatting(String val) {
		val = val.replace("\n\r", "<p>");
		val = val.replace("\n", "<p>");
		val = val.replace("\r", "<p>");
		return val;
	}

	public String formatValue(SessionContext sessionContext, Object value, boolean convertToHtml,
			boolean initNodeEdit) {
		try {
			if (value instanceof Date) {
				return sessionContext.formatTime((Date) value);
			} else {
				String ret = value.toString();

				/*
				 * If we are doing an initNodeEdit we don't do this, because we want the text to
				 * render to the user exactly as they had typed it and not with links converted.
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
	 * Searches in 'val' anywhere there is a line that begins with http:// (or
	 * https), and replaces that with the normal way of doing a link in markdown. So
	 * we are injecting a snippet of markdown (not html)
	 * 
	 * todo-1: i noticed this method gets called during the 'saveNode' processing
	 * and then is called again when the server refreshes the whole page. This is
	 * something that is a slight bit of wasted processing.
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

