package org.subnode.service;

import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.config.SpringContextUtil;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoEventListener;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodePropVal;
import org.subnode.util.ExUtil;
import org.subnode.util.FileTools;
import org.subnode.util.StreamUtil;
import org.subnode.util.ValContainer;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;

import org.apache.commons.io.FileUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;

/**
 * Import/Export of Raw JSON and Binaries to and from filesystem/classpath)
 */
@Component
@Scope("prototype")
public class ExportJsonService {
	private static final Logger log = LoggerFactory.getLogger(ExportJsonService.class);

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private MongoApi api;

	@Autowired
	private GridFsTemplate grid;

	@Autowired
	private AppProp appProp;

	/* This object is Threadsafe so this is the correct usage 'static final' */
	private static final ObjectMapper objectMapper = new ObjectMapper();
	static {
		objectMapper.setSerializationInclusion(Include.NON_NULL);
	}
	private static final ObjectWriter jsonWriter = objectMapper.writerWithDefaultPrettyPrinter();

	/*
	 * todo-1: need capability to handle binary files also, but before implementing
	 * that look for any export options on the grid api itself.
	 * 
	 * Dumps all nodes that have property "pth" starting with 'pathPrefix', or all
	 * nodes if pathPrefix is null.
	 */
	public String dumpAllNodes(MongoSession session, String pathPrefix, String fileName) {
		try {
			if (!FileTools.dirExists(appProp.getAdminDataFolder())) {
				throw ExUtil.newEx("adminDataFolder does not exist");
			}

			String targetFolder = appProp.getAdminDataFolder() + File.separator + fileName;
			FileTools.createDirectory(targetFolder);

			/* This is not a typo, this path will be like ".../fileName/fileName.json" */
			String fullFileName = targetFolder + File.separator + fileName + ".json";

			ValContainer<Integer> numDocs = new ValContainer<Integer>(0);
			ValContainer<Integer> numBins = new ValContainer<Integer>(0);

			byte[] newLine = "\n,\n".getBytes(StandardCharsets.UTF_8);

			Query query = new Query();
			Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(api.regexRecursiveChildrenOfPath(pathPrefix));
			query.addCriteria(criteria);

			Iterable<SubNode> iter = ops.find(query, SubNode.class);

			BufferedOutputStream os = null;
			try {
				os = new BufferedOutputStream(new FileOutputStream(fullFileName));
				final BufferedOutputStream _os = os;
				iter.forEach((node) -> {

					String binFileName = node.getStringProp(NodeProp.BIN_FILENAME.toString());
					if (binFileName != null) {
						if (saveBinaryToFileSystem(binFileName, targetFolder, node)) {
							numBins.setVal(numBins.getVal() + 1);
						}
					} else {
						String path = node.getPath();
						log.debug("Node has no binary: " + path);
					}

					try {
						String json = jsonWriter.writeValueAsString(node);
						_os.write(json.getBytes(StandardCharsets.UTF_8));
						_os.write(newLine);
						numDocs.setVal(numDocs.getVal() + 1);
					} catch (Exception e) {
						// todo-1
						e.printStackTrace();
					}
				});
				os.flush();
			} catch (Exception ex) {
				throw ExUtil.newEx(ex);
			} finally {
				StreamUtil.close(os);
			}

			return "NodeCount: " + numDocs.getVal() + " exported to " + fileName + ". BinaryCount=" + numBins.getVal()
					+ "<p>";
		} catch (Exception e) {
			return "Failed exporting " + fileName;
		}
	}

	private boolean readBinaryFromResource(MongoSession session, SubNode node, String binFileName, String subFolder) {
		boolean ret = false;

		String binMime = node.getStringProp(NodeProp.BIN_MIME.toString());
		if (binMime != null) {
			log.debug("Mime: " + binMime);
		}

		ObjectId oid = node.getId();
		if (oid != null) {

			InputStream is = null;
			try {
				String resourceName = "classpath:/nodes/" + subFolder + "/" + oid.toHexString() + "-" + binFileName;
				Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
				is = resource.getInputStream();

				DBObject metaData = new BasicDBObject();
				metaData.put("nodeId", oid);

				String id = grid.store(is, binFileName, binMime, metaData).toString();

				node.setProp("bin", new SubNodePropVal(id));
				api.save(session, node);

			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				StreamUtil.close(is);
			}
		} else {
			log.debug("unable to get oid");
		}
		return ret;
	}

	private boolean saveBinaryToFileSystem(String binFileName, String targetFolder, SubNode node) {
		boolean ret = false;
		if (binFileName != null) {
			log.debug("FileName: " + binFileName);
		}

		ObjectId oid = node.getId();
		if (oid != null) {
			// log.debug("oid=" + oid.toString());
			InputStream is = api.getStreamByNodeId(oid);
			if (is != null) {
				try {
					String targetFileName = targetFolder + File.separator + oid.toHexString() + "-" + binFileName;
					File targetFile = new File(targetFileName);
					FileUtils.copyInputStreamToFile(is, targetFile);
				} catch (Exception e) {
					e.printStackTrace();
				} finally {
					StreamUtil.close(is);
				}

				ret = true;
			} else {
				log.debug("Unable to get inputstream or oid.");
			}
		} else {
			log.debug("unable to get oid");
		}
		return ret;
	}

	/*
	 * Imports the data from /src/main/resources/nodes/[subFolder] into the db,
	 * which will update the targetPath node path (like "/r/public"), content on the
	 * tree.
	 */
	public String resetNode(MongoSession session, String subFolder) {
		try {
			MongoEventListener.parentCheckEnabled = false;
			String resourceName = "classpath:/nodes/" + subFolder + "/" + subFolder + ".json";
			Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));

			try {
				String line;
				StringBuilder buf = new StringBuilder();

				while ((line = in.readLine()) != null) {
					if (!line.equals(",")) {
						buf.append(line);
						buf.append("\n"); // not needed right?
						continue;
					}
					String json = buf.toString();
					buf.setLength(0);

					// log.debug("JSON: " + json);

					// jsonToNodeService.importJsonContent(json, node);
					SubNode node = objectMapper.readValue(json, SubNode.class);
					api.save(session, node);

					String binFileName = node.getStringProp(NodeProp.BIN_FILENAME.toString());
					if (binFileName != null) {
						ObjectId nodeId = node.getId();

						/*
						grid.delete(new Query(Criteria.where("_id").is(id)));
						todo-2: Is this the fastest way to find a grid id (using metadata.nodeID
						query) instead of some more 'core' ID, native to grid maybe ?
						*/
						grid.delete(new Query(Criteria.where("metadata.nodeId").is(nodeId)));
						readBinaryFromResource(session, node, binFileName, subFolder);
					}
				}
			} finally {
				MongoEventListener.parentCheckEnabled = true;
				StreamUtil.close(in);
			}
			log.debug("import successful.");
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return "success!";
	}
}
