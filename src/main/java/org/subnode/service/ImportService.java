package org.subnode.service;

import java.io.BufferedInputStream;
import java.io.InputStream;

import org.subnode.config.SpringContextUtil;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.ThreadLocals;

import org.apache.commons.io.input.AutoCloseInputStream;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class ImportService {
	private static final Logger log = LoggerFactory.getLogger(ImportService.class);

	@Autowired
	private MongoApi api;

	public ResponseEntity<?> streamImport(MongoSession session, String nodeId, MultipartFile[] uploadFiles) {
		if (nodeId == null) {
			throw ExUtil.newEx("target nodeId not provided");
		}
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}

		SubNode node = api.getNode(session, nodeId);
		if (node == null) {
			throw ExUtil.newEx("Node not found.");
		}

		if (uploadFiles.length != 1) {
			throw ExUtil.newEx("Multiple file import not allowed");
		}

		MultipartFile uploadFile = uploadFiles[0];

		String fileName = uploadFile.getOriginalFilename();
		if (!StringUtils.isEmpty(fileName)) {
			log.debug("Uploading file: " + fileName);

			try {
				if (fileName.toLowerCase().endsWith(".zip")) {
					importZipStream(session, uploadFile.getInputStream(), node);
				}
				if (fileName.toLowerCase().endsWith(".tar")) {
					importTarStream(session, uploadFile.getInputStream(), node);
				}
				else {
					throw ExUtil.newEx("Only ZIP files are currently supported for importing.");
				}
			} catch (Exception ex) {
				throw ExUtil.newEx(ex);
			}
		}

		return new ResponseEntity<>(HttpStatus.OK);
	}

	private void importZipStream(MongoSession session, InputStream inputStream, SubNode targetNode) {
		BufferedInputStream in = null;
		try {
			log.debug("Import ZIP to Node: " + targetNode.getPath());
			in = new BufferedInputStream(new AutoCloseInputStream(inputStream));

			ImportZipService importZipService = (ImportZipService) SpringContextUtil.getBean(ImportZipService.class);
			importZipService.importZipFileFromStream(session, inputStream, targetNode, false);
			api.saveSession(session);
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			/* The importXML should have already closed, but we add here just to be sure */
			StreamUtil.close(in);
		}
	}

	private void importTarStream(MongoSession session, InputStream inputStream, SubNode targetNode) {
		BufferedInputStream in = null;
		try {
			throw new RuntimeException("TAR import not yet implemented");
			// log.debug("Import TAR to Node: " + targetNode.getPath());
			// in = new BufferedInputStream(new AutoCloseInputStream(inputStream));

			// ImportTarService importTarService = (ImportTarService) SpringContextUtil.getBean(ImportTarService.class);
			// importTarService.importZipFileFromStream(session, inputStream, targetNode, false);
			// api.saveSession(session);
		} catch (Exception ex) {
			throw ExUtil.newEx(ex);
		} finally {
			/* The importXML should have already closed, but we add here just to be sure */
			StreamUtil.close(in);
		}
	}

}
