package quanta.service.imports;

import java.io.InputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.util.StreamUtil;
import quanta.util.TL;

@Component
@Scope("prototype")
public class ImportTarService extends ImportArchiveBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(ImportTarService.class);
    private TarArchiveInputStream zis;

    public SubNode importFromZippedStream(InputStream is, SubNode node, boolean isNonRequestThread) {
        InputStream gis = null;
        try {
            gis = new GzipCompressorInputStream(is);
            return importFromStream(gis, node, isNonRequestThread);
        } catch (Exception e) {
            throw new RuntimeEx(e);
        } finally {
            StreamUtil.close(gis);
        }
    }

    /* Returns the first node created which is always the root of the import */
    public SubNode importFromStream(InputStream is, SubNode node, boolean isNonRequestThread) {
        if (used) {
            throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
        }
        used = true;
        AccountNode userNode = svc_user.getAccountByUserNameAP(TL.getSC().getUserName());
        if (userNode == null) {
            throw new RuntimeEx("UserNode not found: " + TL.getSC().getUserName());
        }
        try {
            targetPath = node.getPath();
            zis = new TarArchiveInputStream(is);
            TarArchiveEntry entry;

            while ((entry = zis.getNextTarEntry()) != null) {
                if (!entry.isDirectory()) {
                    processFile(entry, zis, userNode.getOwner());
                }
            }
        } catch (final Exception ex) {
            throw new RuntimeEx(ex);
        } finally {
            StreamUtil.close(zis);
        }
        return importRootNode;
    }
}
