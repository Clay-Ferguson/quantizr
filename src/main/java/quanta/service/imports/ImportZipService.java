package quanta.service.imports;

import java.io.InputStream;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.TL;

/**
 * Import from ZIP files. Imports zip files that have the same type of directory structure and
 * content as the zip files that are exported from SubNode. The zip file doesn't of course have to
 * have been actually exported from SubNode in order to import it, but merely have the proper
 * layout/content.
 */
@Component
@Scope("prototype")
public class ImportZipService extends ImportArchiveBase {
    private static Logger log = LoggerFactory.getLogger(ImportZipService.class);
    private ZipArchiveInputStream zis;

    /*
     * imports the file directly from an internal resource file (classpath resource, built into WAR file
     * itself)
     */
    public SubNode inportFromResource(String resourceName, SubNode node, String nodeName) {
        Resource resource = context.getResource(resourceName);
        InputStream is = null;
        SubNode rootNode = null;
        try {
            is = resource.getInputStream();
            rootNode = importFromStream(is, node, true);
        } catch (Exception e) {
            throw new RuntimeEx(e);
        } finally {
            StreamUtil.close(is);
        }
        log.debug("Finished Input From Zip file.");
        svc_mongoUpdate.saveSession();
        return rootNode;
    }

    /*
     * Returns the first node created which is always the root of the import
     *
     * Assumes ms has already been verified as owner of 'node'
     */
    public SubNode importFromStream(InputStream inputStream, SubNode node, boolean isNonRequestThread) {
        SessionContext sc = TL.getSC();
        if (used) {
            throw new RuntimeEx("Prototype bean used multiple times is not allowed.");
        }
        used = true;
        AccountNode userNode = svc_user.getAccountByUserNameAP(sc.getUserName());
        if (userNode == null) {
            throw new RuntimeEx("UserNode not found: " + sc.getUserName());
        }
        LimitedInputStreamEx is = null;
        try {
            targetPath = node.getPath();
            long maxFileSize = svc_user.getUserStorageRemaining();
            long maxSize = TL.hasAdminPrivileges() ? Integer.MAX_VALUE : maxFileSize;
            is = new LimitedInputStreamEx(inputStream, maxSize);
            zis = new ZipArchiveInputStream(is);
            ZipArchiveEntry entry;

            while ((entry = zis.getNextZipEntry()) != null) {
                if (!entry.isDirectory()) {
                    processFile(entry, zis, userNode.getOwner());
                }
            }
        } catch (Exception ex) {
            throw new RuntimeEx(ex);
        } finally {
            StreamUtil.close(is);
        }
        return importRootNode;
    }
}
