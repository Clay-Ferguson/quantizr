package org.subnode.service;

import java.io.InputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;
import static org.subnode.util.Util.*;

@Component
@Scope("prototype")
public class ImportTarService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	private TarArchiveInputStream zis;

	/* Returns the first node created which is always the root of the import */
	public SubNode importFromStream(MongoSession ms, InputStream is, SubNode node, boolean isNonRequestThread) {
		if (used) {
			throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
		}
		used = true;

		SubNode userNode = read.getUserNodeByUserName(auth.getAdminSession(), ThreadLocals.getSC().getUserName());
		if (no(userNode)) {
			throw new RuntimeEx("UserNode not found: " + ThreadLocals.getSC().getUserName());
		}

		try {
			targetPath = node.getPath();
			this.session = ms;

			zis = new TarArchiveInputStream(is);
			TarArchiveEntry entry;
			while (ok(entry = zis.getNextTarEntry())) {
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
