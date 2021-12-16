package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.InputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;

@Lazy
@Component
@Scope("prototype")
public class ImportTarService extends ImportArchiveBase {
	private static final Logger log = LoggerFactory.getLogger(ImportZipService.class);

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoRead read;

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
