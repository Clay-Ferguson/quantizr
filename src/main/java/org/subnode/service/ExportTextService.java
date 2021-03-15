package org.subnode.service;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.model.MerkleLink;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.ExportRequest;
import org.subnode.response.ExportResponse;
import org.subnode.util.ExUtil;
import org.subnode.util.FileUtils;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;

@Component
@Scope("prototype")
public class ExportTextService {
	private static final Logger log = LoggerFactory.getLogger(ExportTextService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private SubNodeUtil util;

	@Autowired
	private AppProp appProp;

	@Autowired
	private IPFSService ipfs;

	private MongoSession session;

	private BufferedOutputStream output = null;
	private String shortFileName;
	private String fullFileName;
	private static final byte[] NL = "\n".getBytes(StandardCharsets.UTF_8);
	private ExportRequest req;
	private ExportResponse res;

	/*
	 * Exports the node specified in the req. If the node specified is "/", or the
	 * repository root, then we don't expect a filename, because we will generate a
	 * timestamped one.
	 */
	public void export(MongoSession session, ExportRequest req, ExportResponse res) {
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
	
		this.session = session;
		this.req = req;
		this.res = res;
		String nodeId = req.getNodeId();

		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist");
		}

		if (nodeId.equals("/")) {
			throw ExUtil.wrapEx("Exporting entire repository is not supported.");
		} else {
			log.info("Exporting to Text File");
			exportNodeToFile(session, nodeId);
			res.setFileName(shortFileName);
		}

		res.setSuccess(true);
	}

	private void exportNodeToFile(MongoSession session, String nodeId) {
		if (!FileUtils.dirExists(appProp.getAdminDataFolder())) {
			throw ExUtil.wrapEx("adminDataFolder does not exist.");
		}

		SubNode exportNode = read.getNode(session, nodeId, true);
		String fileName = util.getExportFileName(req.getFileName(), exportNode);
		shortFileName = fileName + ".md";
		fullFileName = appProp.getAdminDataFolder() + File.separator + shortFileName;

		try {
			log.debug("Export Node: " + exportNode.getPath() + " to file " + fullFileName);
			output = new BufferedOutputStream(new FileOutputStream(fullFileName));
			recurseNode(exportNode, 0);
			output.flush();
			StreamUtil.close(output); 

			if (req.isToIpfs()) {
				// now write the file we just generated out to IPFS.
				FileInputStream is = null;
				try {
					is = new FileInputStream(fullFileName);
					String mime = "text/markdown";
					MerkleLink ret = ipfs.addFromStream(session, is, shortFileName, mime, null, null, false);
					ipfs.writeIpfsExportNode(session, ret.getHash(), mime, shortFileName, null);
					res.setIpfsCid(ret.getHash());
					res.setIpfsMime(mime);
				} finally {
					StreamUtil.close(is);
				}
			}

		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		} finally {
			StreamUtil.close(output); 
			(new File(fullFileName)).deleteOnExit();
		}
	}

	private void recurseNode(SubNode node, int level) {
		if (node == null)
			return;

		/* process the current node */
		processNode(node);

		Sort sort = Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL);

		for (SubNode n : read.getChildren(session, node, sort, null, 0)) {
			recurseNode(n, level + 1);
		}
	}

	private void processNode(SubNode node) {
		print(node.getContent());
		print("\n");
	}

	private void print(String val) {
		try {
			output.write(val.getBytes(StandardCharsets.UTF_8));
			if (!val.endsWith("\n")) {
				output.write(NL);
			}
		} catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}
}
