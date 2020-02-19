package org.subnode.service;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.model.ExportOutputType;
import org.subnode.model.ExportPropertyInfo;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileTools;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/**
 * Export to Text file
 * 
 * todo-2: add options user can select like whether or not to include property
 * names (divider line), etc. For now we hardcode to include properties.
 * 
 * todo-2: there should be some ORDERING of properties, like 'content' maybe
 * always at the top etc.
 * 
 * todo-2: need to add better mechanism for deleting files after a certain
 * amount of time.
 * 
 */
@Component
@Scope("prototype")
public class ExportTxtService {
	private static final Logger log = LoggerFactory.getLogger(ExportTxtService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private AppProp appProp;

	@Autowired
	private SessionContext sessionContext;

	private MongoSession session;

	private BufferedOutputStream output = null;
	private String shortFileName;
	private String fullFileName;

	private static final byte[] NL = "\n".getBytes(StandardCharsets.UTF_8);

	private ExportResponse res;
	private ExportOutputType outputType;

	/*
	 * Exports the node specified in the req. If the node specified is "/", or the
	 * repository root, then we don't expect a filename, because we will generate a
	 * timestamped one.
	 */
	public void export(MongoSession session, ExportOutputType outputType, ExportRequest req, ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.outputType = outputType;
		this.res = res;
		this.session = session;

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean exportAllowed = userPreferences != null ? userPreferences.isExportAllowed() : false;
		if (!exportAllowed && !sessionContext.isAdmin()) {
			throw ExUtil.newEx("You are not authorized to export.");
		}

		String nodeId = req.getNodeId();

		if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.newEx("adminDataFolder does not exist");
		}

		if (nodeId.equals("/")) {
			throw ExUtil.newEx("Exporting entire repository is not supported.");
		} else {
			log.info("Exporting to Text File");
			exportNodeToFile(session, nodeId);
			res.setFileName(shortFileName);
		}

		res.setSuccess(true);
	}

	private void exportNodeToFile(MongoSession session, String nodeId) {
		shortFileName = "f" + util.getGUID() + getFileExtension();
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		SubNode exportNode = api.getNode(session, nodeId, true);
		try {
			log.debug("Export Node: " + exportNode.getPath() + " to file " + fullFileName);
			output = new BufferedOutputStream(new FileOutputStream(fullFileName));
			recurseNode(exportNode, 0);
			output.flush();
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			StreamUtil.close(output);
			(new File(fullFileName)).deleteOnExit();
		}
	}

	private String getFileExtension() {
		switch (outputType) {
		case MD:
			return "md";
		case JSON:
			return "json";
		default:
			throw new RuntimeException("unknown export type.");
		}
	}

	private void recurseNode(SubNode node, int level) {
		if (node == null)
			return;

		/* process the current node */
		processNode(node);

		for (SubNode n : api.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null)) {
			recurseNode(n, level + 1);
		}
	}

	private void processNode(SubNode node) {
		switch (outputType) {
		case MD:
			exportNodeAsMarkdown(node);
			break;
		case JSON:
			exportNodeAsJSON(node);
			break;
		default:
			throw new RuntimeException("unkwnown output type");
		}
	}

	private void exportNodeAsJSON(SubNode node) {
		print(XString.prettyPrint(node) + "\n");
	}

	private void exportNodeAsMarkdown(SubNode node) {
		try {
			if (StringUtils.isNotEmpty(node.getContent())) {
				print(node.getContent());
			}

			if (node.getProperties() != null) {
				node.getProperties().forEach((propName, propVal) -> {
					// log.debug(" PROP: "+propName);

					if (propName.equals(NodeProp.BIN_FILENAME)) {
					}

					if (propName.equals(NodeProp.BIN_VER)) {
					} else {
						ExportPropertyInfo propInfo = new ExportPropertyInfo();
						propInfo.setName(propName);
						propInfo.setVal(propVal.getValue());
						// need option to print these or not
					}
				});
			}
			print("\n----");
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	private void print(String val) {
		try {
			output.write(val.getBytes(StandardCharsets.UTF_8));
			if (!val.endsWith("\n")) {
				output.write(NL);
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}
}

