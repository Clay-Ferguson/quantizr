package org.subnode.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

import com.mongodb.client.MongoDatabase;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.config.AppFilter;
import org.subnode.config.AppSessionListener;
import org.subnode.model.IPFSObjectStat;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoAppConfig;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/**
 * Service methods for System related functions. Admin functions.
 */
@Component
public class SystemService {
	private static final Logger log = LoggerFactory.getLogger(SystemService.class);

	@Autowired
	private MongoAppConfig mac;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoDelete delete;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private MongoUtil mongoUtil;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private ExportJsonService exportJsonService;

	@Autowired
	private AttachmentService attachmentService;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private IPFSService ipfsService;

	public String rebuildIndexes() {
		if (!ThreadLocals.getSessionContext().isAdmin()) {
			throw ExUtil.wrapEx("admin only function.");
		}

		adminRunner.run(mongoSession -> {
			mongoUtil.rebuildIndexes(mongoSession);
		});
		return "success.";
	}

	public String compactDb() {
		delete.deleteNodeOrphans(null);
		// do not delete.
		// userManagerService.cleanUserAccounts();

		/*
		 * Create map to hold all user account storage statistics which gets updated by
		 * the various processing in here and then written out in 'writeUserStats' below
		 */
		final HashMap<ObjectId, UserStats> statsMap = new HashMap<ObjectId, UserStats>();

		attachmentService.gridMaintenanceScan(statsMap);
		ipfsGarbageCollect(statsMap);

		adminRunner.run(session -> {
			userManagerService.writeUserStats(session, statsMap);
		});

		String ret = runMongoDbCommand(new Document("compact", "nodes"));
		return ret;
	}

	public String ipfsGarbageCollect(HashMap<ObjectId, UserStats> statsMap) {
		String ret = update.releaseOrphanIPFSPins(statsMap);
		return ret;
	}

	public String validateDb() {
		// https://docs.mongodb.com/manual/reference/command/validate/
		String ret = runMongoDbCommand(new Document("validate", "nodes").append("full", true));
		return ret;
	}

	public String runMongoDbCommand(Document doc) {
		MongoDatabase database = mac.mongoClient().getDatabase(MongoAppConfig.databaseName);
		Document result = database.runCommand(doc);

		StringBuilder ret = new StringBuilder();
		ret.append("Results:\n");
		for (Map.Entry<String, Object> set : result.entrySet()) {
			ret.append(String.format("%s: %s\n", set.getKey(), set.getValue()));
		}
		return ret.toString();
	}

	public static void logMemory() {
		// Runtime runtime = Runtime.getRuntime();
		// long freeMem = runtime.freeMemory() / ONE_MB;
		// long maxMem = runtime.maxMemory() / ONE_MB;
		// log.info(String.format("GC Cycle. FreeMem=%dMB, MaxMem=%dMB", freeMem,
		// maxMem));
	}

	public String getJson(MongoSession session, String nodeId) {
		SubNode node = read.getNode(session, nodeId, true);
		if (node != null) {
			String ret = XString.prettyPrint(node);

			String ipfsLink = node.getStrProp(NodeProp.IPFS_LINK);
			if (ipfsLink != null) {
				IPFSObjectStat fullStat = ipfsService.objectStat(ipfsLink, false);
				if (fullStat != null) {
					ret += "\n\nIPFS Object Stats:\n" + XString.prettyPrint(fullStat);
				}
			}

			return ret;
		} else {
			return "node not found!";
		}
	}

	public String getSystemInfo() {
		StringBuilder sb = new StringBuilder();
		Runtime runtime = Runtime.getRuntime();
		runtime.gc();
		long freeMem = runtime.freeMemory() / Const.ONE_MB;
		sb.append(String.format("Server Free Memory: %dMB\n", freeMem));
		sb.append(String.format("Session Count: %d\n", AppSessionListener.getSessionCounter()));
		sb.append(getIpReport());
		sb.append("Node Count: " + read.getNodeCount(null) + "\n");
		sb.append("Attachment Count: " + attachmentService.getGridItemCount() + "\n");
		sb.append(userManagerService.getUserAccountsReport(null));

		sb.append(ActPubService.getStatsReport());

		// oops this is worthless, because it's inside the docker image, but I'm leaving
		// in place just in case in the future we do need to run some commands docker
		// sb.append(runBashCommand("DISK STORAGE", "df -h"));
		return sb.toString();
	}

	private static String runBashCommand(String title, String command) {
		ProcessBuilder pb = new ProcessBuilder();
		pb.command("bash", "-c", command);

		// pb.directory(new File(dir));
		// pb.redirectErrorStream(true);

		StringBuilder output = new StringBuilder();
		output.append("<pre>");
		output.append(title);
		try {
			Process p = pb.start();
			String s;

			BufferedReader stdout = new BufferedReader(new InputStreamReader(p.getInputStream()));
			while ((s = stdout.readLine()) != null) {
				output.append(s);
				output.append("\n");
			}

			// output.append("Exit value: " + p.waitFor());
			// p.getInputStream().close();
			// p.getOutputStream().close();
			// p.getErrorStream().close();
		} catch (Exception e) {
			// todo-1: do something here.
		}
		output.append("</pre><p>");
		return output.toString();
	}

	private static String getIpReport() {
		return "Number of Unique IPs since startup: " + AppFilter.getUniqueIpHits().size() + "\n";
		// StringBuilder sb = new StringBuilder();
		// sb.append("Unique IPs During Run<br>");
		// int count = 0;
		// HashMap<String, Integer> map = AppFilter.getUniqueIpHits();
		// synchronized (map) {
		// for (String key : map.keySet()) {
		// int hits = map.get(key);
		// sb.append("IP=" + key + " hits=" + hits);
		// sb.append("<br>");
		// count++;
		// }
		// }
		// sb.append("count=" + count + "<br>");
		// return sb.toString();
	}
}
