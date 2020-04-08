package org.subnode.service;

import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import java.io.InputStream;

import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@Scope("prototype")
public class ImportTarService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	private TarArchiveInputStream zis;

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(MongoSession session, InputStream is, SubNode node,
			boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeException("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		if (!isNonRequestThread) {
			UserPreferences userPreferences = sessionContext.getUserPreferences();
			boolean importAllowed = userPreferences != null ? userPreferences.isImportAllowed() : false;
			if (!importAllowed && !sessionContext.isAdmin()) {
				throw ExUtil.newEx("You are not authorized to import.");
			}
		}

		try {
			targetPath = node.getPath();
			this.session = session;

			zis = new TarArchiveInputStream(is);
			TarArchiveEntry entry;
			while ((entry = zis.getNextTarEntry()) != null) {
				if (!entry.isDirectory()) {
					processFile(entry, zis);
				}
			}
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			StreamUtil.close(zis);
		}
		return importRootNode;
	}
}
