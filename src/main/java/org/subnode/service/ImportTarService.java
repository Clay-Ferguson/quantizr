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
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;

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
	public SubNode importFromStream(final MongoSession ms, final InputStream is, final SubNode node,
			final boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		final SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), ThreadLocals.getSC().getUserName());
		if (userNode == null) {
			throw new RuntimeEx("UserNode not found: " + ThreadLocals.getSC().getUserName());
		}

		try {
			targetPath = node.getPath();
			this.session = ms;

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
