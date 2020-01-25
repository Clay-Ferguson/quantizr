package org.subnode.service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import org.subnode.config.AppProp;
import org.subnode.config.NodeProp;
import org.subnode.config.SessionContext;
import org.subnode.model.ExportNodeInfo;
import org.subnode.model.ExportPropertyInfo;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileTools;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

import org.apache.commons.io.IOUtils;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;

/**
 * Base class for exporting to archives. Two superclasses will exist: 1) Zip
 * Export 2) TAR export
 */
// @Component
// @Scope("prototype")
public abstract class ExportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ExportArchiveBase.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private SubNodeUtil util;

	// private ZipOutputStream zos;
	private String shortFileName;
	private String fullFileName;

	/* This object is Threadsafe so this is the correct usage 'static final' */
	private static final ObjectMapper objectMapper = new ObjectMapper();
	static {
		objectMapper.setSerializationInclusion(Include.NON_NULL);
	}
	private static final ObjectWriter jsonWriter = objectMapper.writerWithDefaultPrettyPrinter();

	/*
	 * It's possible that nodes recursively contained under a given node can have
	 * same name, so we have to detect that and number them, so we use this hashset
	 * to detect existing filenames.
	 */
	private HashSet<String> fileNameSet = new HashSet<String>();

	@Autowired
	private AppProp appProp;

	@Autowired
	private SessionContext sessionContext;

	private MongoSession session;

	public void export(MongoSession session, ExportRequest req, ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		this.session = session;

		UserPreferences userPreferences = sessionContext.getUserPreferences();
		boolean exportAllowed = userPreferences != null ? userPreferences.isExportAllowed() : false;
		if (!exportAllowed && !sessionContext.isAdmin()) {
			throw ExUtil.newEx("You are not authorized to export.");
		}

		if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.newEx("adminDataFolder does not exist: " + appProp.getAdminDataFolder());
		}

		String nodeId = req.getNodeId();

		shortFileName = "f" + util.getGUID() + "." + getFileExtension();
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		boolean success = false;
		try {
			// zos = new ZipOutputStream(new FileOutputStream(fullFileName));
			openOutputStream(fullFileName);

			SubNode node = api.getNode(session, nodeId);
			api.authRequireOwnerOfNode(session, node);
			recurseNode("", node, 0);
			res.setFileName(shortFileName);
			success = true;
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			// StreamUtil.close(zos);
			closeOutputStream();

			if (!success) {
				FileTools.deleteFile(fullFileName);
			}
		}

		res.setSuccess(true);
	}

	public abstract String getFileExtension();

	public abstract void openOutputStream(String fileName);

	public abstract void closeOutputStream();

	public abstract void addEntry(String fileName, byte[] bytes);

	private void recurseNode(String parentFolder, SubNode node, int level) {
		if (node == null)
			return;

		/* process the current node */
		String folder = processNodeExport(parentFolder, node);

		for (SubNode n : api.getChildren(session, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null)) {
			recurseNode(parentFolder + "/" + folder, n, level + 1);
		}
	}

	/*
	 * NOTE: It's correct that there's no finally block in here enforcing the
	 * closeEntry, becasue we let exceptions bubble all the way up to abort and even
	 * cause the zip file itself (to be deleted) since it was unable to be written
	 * to.
	 */
	private String processNodeExport(String parentFolder, SubNode node) {
		try {
			// log.debug("Processing Node: " + node.getPath());

			String fileName = generateFileNameFromNode(node);

			/*
			 * the processProperty calls in the while loop below also loads into these
			 * variables
			 */
			List<ExportPropertyInfo> allProps = new LinkedList<ExportPropertyInfo>();
			ValContainer<String> contentText = new ValContainer<String>();
			ValContainer<String> binVerProp = new ValContainer<String>();
			ValContainer<String> binFileNameProp = new ValContainer<String>();

			if (node.getProperties() != null) {
				node.getProperties().forEach((propName, propVal) -> {

					// log.debug(" PROP: "+propName);

					if (propName.equals(NodeProp.BIN_FILENAME)) {
						binFileNameProp.setVal(propVal.getValue().toString());
					}

					if (propName.equals(NodeProp.BIN_VER)) {
						binVerProp.setVal(propVal.getValue().toString());
					} else {
						ExportPropertyInfo propInfo = new ExportPropertyInfo();
						propInfo.setName(propName);
						propInfo.setVal(propVal.getValue());

						// I decided we should just infer the type from the property name and not
						// store it in the file.
						// propInfo.setType(NodePropertyTypes.getTypeOfObject(propVal.getValue()));

						allProps.add(propInfo);
					}
				});
			}

			ExportNodeInfo expInfo = new ExportNodeInfo();
			expInfo.setPath(node.getPath());
			expInfo.setCont(node.getContent());
			expInfo.setId(node.getId().toHexString());
			expInfo.setType(node.getType());
			expInfo.setOrdinal(node.getOrdinal());
			expInfo.setProps(allProps);

			String json = jsonWriter.writeValueAsString(expInfo);

			// Start JSON files with '.' because we want them hidden.
			addFileEntry(parentFolder + "/" + fileName + "/." + fileName + ".json",
					json.getBytes(StandardCharsets.UTF_8));

			/*
			 * todo-2: could add another export option to just dump these into a single text
			 * file
			 */
			// addFileEntry(parentFolder + "/" + fileName + "/node.json",
			// XString.prettyPrint(node).getBytes(StandardCharsets.UTF_8));

			/* If content property was found write it into separate file */
			if (contentText.getVal() != null) {
				addFileEntry(parentFolder + "/" + fileName + "/" + fileName + ".md",
						contentText.getVal().getBytes(StandardCharsets.UTF_8));
			}

			/*
			 * If we had a binary property on this node we write the binary file into a
			 * separate file
			 */
			if (binVerProp.getVal() != null) {
				String binFileNameStr = binFileNameProp.getVal() != null ? binFileNameProp.getVal() : "binary";
				AutoCloseInputStream is = null;

				is = api.getAutoClosingStream(session, node, null);
				// long size = node.getIntProp(NodeProp.BIN_SIZE);
				addFileEntry(parentFolder + "/" + fileName + "/" + binFileNameStr, IOUtils.toByteArray(is));
			}

			return fileName;
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		}
	}

	private String cleanupFileName(String fileName) {
		fileName = fileName.trim();
		fileName = FileTools.ensureValidFileNameChars(fileName);
		fileName = XString.stripIfStartsWith(fileName, "-");
		fileName = XString.stripIfEndsWith(fileName, "-");
		return fileName;
	}

	private void addFileEntry(String fileName, byte[] bytes) {
		/*
		 * If we have duplicated a filename, number it sequentially to create a unique
		 * file
		 */
		if (fileNameSet.contains(fileName)) {
			int idx = 1;
			String numberedFileName = fileName + String.valueOf(idx);
			while (fileNameSet.contains(numberedFileName)) {
				numberedFileName = fileName + String.valueOf(++idx);
			}
			fileName = numberedFileName;
		}

		fileNameSet.add(fileName);

		addEntry(fileName, bytes);

		// log.debug("ZIPENTRY: " + fileName);
		// ZipEntry zi = new ZipEntry(fileName);
		// try {
		// zos.putNextEntry(zi);
		// zos.write(bytes);
		// zos.closeEntry();
		// } catch (Exception ex) {
		// throw ExUtil.newEx(ex);
		// }
	}

	private String generateFileNameFromNode(SubNode node) {
		String fileName = node.getName();

		if (StringUtils.isEmpty(fileName)) {
			fileName = node.getContent();
			if (fileName != null) {
				fileName = fileName.trim();
				fileName = XString.truncateAfterFirst(fileName, "\n");
				fileName = XString.truncateAfterFirst(fileName, "\r");
			}
		}

		if (StringUtils.isEmpty(fileName)) {
			fileName = node.getNameOnPath();
		}

		fileName = cleanupFileName(fileName);

		log.debug(" nodePath=[" + node.getPath() + "] fileName=[" + fileName + "]");

		fileName = XString.addLeadingZeroes(String.valueOf(node.getOrdinal()), 5) + "--"
				+ XString.trimToMaxLen(fileName, 40);
		return fileName;
	}
}
