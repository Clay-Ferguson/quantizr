package org.subnode.service;

import java.io.InputStream;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.model.UserPreferences;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;

@Component
@Scope("prototype")
public class ImportTarService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	private TarArchiveInputStream zis;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private MongoRead read;

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(final MongoSession session, final InputStream is, final SubNode node,
			final boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		final SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), sessionContext.getUserName());
		if (userNode == null) {
			throw new RuntimeEx("UserNode not found: " + sessionContext.getUserName());
		}

		if (!isNonRequestThread) {
			final UserPreferences userPreferences = sessionContext.getUserPreferences();
			final boolean importAllowed = userPreferences != null ? userPreferences.isImportAllowed() : false;
			if (!importAllowed && !sessionContext.isAdmin()) {
				throw ExUtil.wrapEx("You are not authorized to import.");
			}
		}

		try {
			targetPath = node.getPath();
			this.session = session;

			zis = new TarArchiveInputStream(is);
			TarArchiveEntry entry;
			while ((entry = zis.getNextTarEntry()) != null) {
				if (!entry.isDirectory()) {
					processFile(entry, zis, userNode.getOwner());
				}
			}
		} catch (final Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(zis);
		}
		return importRootNode;
	}
}
