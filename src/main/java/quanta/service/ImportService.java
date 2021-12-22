package quanta.service;

import static quanta.util.Util.no;
import java.io.BufferedInputStream;
import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import quanta.config.SpringContextUtil;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUpdate;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;
import quanta.util.StreamUtil;
import quanta.util.ThreadLocals;

@Lazy
@Component
public class ImportService {
	private static final Logger log = LoggerFactory.getLogger(ImportService.class);

	@Autowired
	@Lazy
	protected MongoUpdate update;

	@Autowired
	@Lazy
	protected MongoRead read;

	public ResponseEntity<?> streamImport(MongoSession ms, String nodeId, MultipartFile[] uploadFiles) {
		if (no(nodeId)) {
			throw ExUtil.wrapEx("target nodeId not provided");
		}
		ms = ThreadLocals.ensure(ms);

		SubNode node = read.getNode(ms, nodeId);
		if (no(node)) {
			throw ExUtil.wrapEx("Node not found.");
		}

		if (uploadFiles.length != 1) {
			throw ExUtil.wrapEx("Multiple file import not allowed");
		}

		MultipartFile uploadFile = uploadFiles[0];

		String fileName = uploadFile.getOriginalFilename();
		if (!StringUtils.isEmpty(fileName)) {
			log.debug("Uploading file: " + fileName);

			BufferedInputStream in = null;
			try {
				// Import ZIP files
				if (fileName.toLowerCase().endsWith(".zip")) {
					log.debug("Import ZIP to Node: " + node.getPath());
					in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));

					ImportZipService impSvc = (ImportZipService) SpringContextUtil.getBean(ImportZipService.class);
					impSvc.importFromStream(ms, in, node, false);
					update.saveSession(ms);
				} 
				// Import TAR files (non GZipped)
				else if (fileName.toLowerCase().endsWith(".tar")) {
					log.debug("Import TAR to Node: " + node.getPath());
					in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));
					ImportTarService impSvc = (ImportTarService) SpringContextUtil.getBean(ImportTarService.class);
					impSvc.importFromStream(ms, in, node, false);
					update.saveSession(ms);
				} 
				// Import TAR.GZ (GZipped TAR)
				else if (fileName.toLowerCase().endsWith(".tar.gz")) {
					log.debug("Import TAR.GZ to Node: " + node.getPath());
					in = new BufferedInputStream(new AutoCloseInputStream(uploadFile.getInputStream()));
					ImportTarService impSvc = (ImportTarService) SpringContextUtil.getBean(ImportTarService.class);
					impSvc.importFromZippedStream(ms, in, node, false);
					update.saveSession(ms);
				} 
				else {
					throw ExUtil.wrapEx("Only ZIP, TAR, TAR.GZ files are supported for importing.");
				}
			} catch (Exception ex) {
				throw ExUtil.wrapEx(ex);
			} finally {
				StreamUtil.close(in);
			}
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}
}
