package org.subnode.service;

import java.io.InputStream;

import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * Import from ZIP files. Imports zip files that have the same type of directory
 * structure and content as the zip files that are exported from SubNode. The
 * zip file doesn't of course have to have been actually exported from SubNode
 * in order to import it, but merely have the proper layout/content.
 */
@Component
@Scope("prototype")
public class ImportZipService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	private ZipArchiveInputStream zis;

	/*
	 * imports the file directly from an internal resource file (classpath resource,
	 * built into WAR file itself)
	 */
	public SubNode inportFromResource(MongoSession session, String resourceName, SubNode node, String nodeName) {

		Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
		InputStream is = null;
		SubNode rootNode = null;
		try {
			is = resource.getInputStream();
			rootNode = importFromStream(session, is, node, true);
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		} finally {
			StreamUtil.close(is);
		}

		log.debug("Finished Input From Zip file.");
		api.saveSession(session);
		return rootNode;
	}

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(MongoSession session, InputStream is, SubNode node,
			boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		SubNode userNode = api.getUserNodeByUserName(api.getAdminSession(), sessionContext.getUserName());
		if (userNode == null) {
			throw new RuntimeEx("UserNode not found: " + sessionContext.getUserName());
		}

		if (!isNonRequestThread) {
			UserPreferences userPreferences = sessionContext.getUserPreferences();
			boolean importAllowed = userPreferences != null ? userPreferences.isImportAllowed() : false;
			if (!importAllowed && !sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("You are not authorized to import.");
			}
		}

		try {
			targetPath = node.getPath();
			this.session = session;

			zis = new ZipArchiveInputStream(is);
			ZipArchiveEntry entry;
			while ((entry = zis.getNextZipEntry()) != null) {
				if (!entry.isDirectory()) {
					processFile(entry, zis, userNode.getOwner());
				}
			}

		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(zis);
		}
		return importRootNode;
	}
}
