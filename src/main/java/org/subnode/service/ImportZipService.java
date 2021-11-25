package org.subnode.service;

import java.io.InputStream;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.subnode.config.SessionContext;
import org.subnode.config.SpringContextUtil;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;

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

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoUpdate update;

	/*
	 * imports the file directly from an internal resource file (classpath resource,
	 * built into WAR file itself)
	 */
	public SubNode inportFromResource(MongoSession ms, String resourceName, SubNode node, String nodeName) {

		Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
		InputStream is = null;
		SubNode rootNode = null;
		try {
			is = resource.getInputStream();
			rootNode = importFromStream(ms, is, node, true);
		} catch (Exception e) {
			throw ExUtil.wrapEx(e);
		} finally {
			StreamUtil.close(is);
		}

		log.debug("Finished Input From Zip file.");
		update.saveSession(ms);
		return rootNode;
	}

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(MongoSession ms, InputStream inputStream, SubNode node,
			boolean isNonRequestThread) {
		SessionContext sc = ThreadLocals.getSC();
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), sc.getUserName());
		if (userNode == null) {
			throw new RuntimeEx("UserNode not found: " + sc.getUserName());
		}

		LimitedInputStreamEx is = null;
		try {
			targetPath = node.getPath();
			this.session = ms;

			// todo-1: replace with the true amount of storage this user has remaining. Admin is unlimited. 
			int maxSize = sc.isAdmin() ? Integer.MAX_VALUE : Const.DEFAULT_USER_QUOTA;
			is = new LimitedInputStreamEx(inputStream, maxSize);
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
			StreamUtil.close(is);
		}
		return importRootNode;
	}
}
