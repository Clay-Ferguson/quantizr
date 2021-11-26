package org.subnode.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.mongodb.client.MongoDatabase;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.subnode.config.AppSessionListener;
import org.subnode.config.SessionContext;
import org.subnode.filter.HitFilter;
import org.subnode.model.IPFSObjectStat;
import org.subnode.model.UserStats;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoAppConfig;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.StopwatchEntry;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/**
 * Service methods for System related functions. Admin functions.
 */
@Component
public class SystemService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(SystemService.class);

	public String rebuildIndexes() {
		if (!ThreadLocals.getSC().isAdmin()) {
			throw ExUtil.wrapEx("admin only function.");
		}

		arun.run(mongoSession -> {
			util.rebuildIndexes(mongoSession);
			return null;
		});
		return "success.";
	}

	public String compactDb() {
		delete.deleteNodeOrphans(null);
		// do not delete.
		// usrMgr.cleanUserAccounts();

		/*
		 * Create map to hold all user account storage statistics which gets updated by the various
		 * processing in here and then written out in 'writeUserStats' below
		 */
		final HashMap<ObjectId, UserStats> statsMap = new HashMap<>();

		attach.gridMaintenanceScan(statsMap);
		String ret = ipfsGarbageCollect(statsMap);

		arun.run(session -> {
			usrMgr.writeUserStats(session, statsMap);
			return null;
		});

		ret += runMongoDbCommand(new Document("compact", "nodes"));
		return ret;
	}

	public String ipfsGarbageCollect(HashMap<ObjectId, UserStats> statsMap) {
		String ret = ipfs.getRepoGC();
		ret += update.releaseOrphanIPFSPins(statsMap);
		return ret;
	}

	public String validateDb() {
		// https://docs.mongodb.com/manual/reference/command/validate/
		String ret = runMongoDbCommand(new Document("validate", "nodes").append("full", true));
		ret += ipfs.repoVerify();
		ret += ipfs.pinVerify();
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

	public String getJson(MongoSession ms, String nodeId) {
		SubNode node = read.getNode(ms, nodeId, true);
		if (node != null) {
			String ret = XString.prettyPrint(node);

			String ipfsLink = node.getStrProp(NodeProp.IPFS_LINK);
			if (ipfsLink != null) {
				IPFSObjectStat fullStat = ipfs.objectStat(ipfsLink, false);
				if (fullStat != null) {
					ret += "\n\nIPFS Object Stats:\n" + XString.prettyPrint(fullStat);
				}
			}

			return ret;
		} else {
			return "node not found!";
		}
	}

	public String getPerformancerReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("Performance Report: " + ThreadLocals.getSC().getUserName() + "\n");
		int idx = 1;
		synchronized (ThreadLocals.getSC().getStopwatchData()) {
			for (StopwatchEntry se : ThreadLocals.getSC().getStopwatchData()) {
				sb.append(String.valueOf(idx));
				sb.append(": ");
				sb.append(se.getThreadName());
				sb.append(" ");
				sb.append(se.getEvent());
				sb.append(" ");
				sb.append(String.valueOf(se.getDuration()));
				sb.append("\n");
				idx++;
			}
		}
		return sb.toString();
	}

	public String getSystemInfo() {
		StringBuilder sb = new StringBuilder();
		sb.append("Daemons Enabed: " + String.valueOf(appProp.isDaemonsEnabled()) + "\n");
		Runtime runtime = Runtime.getRuntime();
		runtime.gc();
		long freeMem = runtime.freeMemory() / Const.ONE_MB;
		sb.append(String.format("Server Free Mem: %dMB\n", freeMem));
		sb.append(String.format("Sessions: %d\n", AppSessionListener.getSessionCounter()));
		sb.append(getIpReport());
		sb.append("Node Count: " + read.getNodeCount(null) + "\n");
		sb.append("Attachment Count: " + attach.getGridItemCount() + "\n");
		sb.append(usrMgr.getUserAccountsReport(null));

		sb.append(apub.getStatsReport());

		if (!StringUtils.isEmpty(appProp.getIPFSApiHostAndPort())) {
			sb.append(ipfs.getRepoStat());
		}

		RuntimeMXBean runtimeMxBean = ManagementFactory.getRuntimeMXBean();
		List<String> arguments = runtimeMxBean.getInputArguments();
		sb.append("\nJava VM args:\n");
		for (String arg : arguments) {
			sb.append(arg + "\n");
		}

		// oops this is worthless, because it's inside the docker image, but I'm leaving
		// in place just in case in the future we do need to run some commands docker
		// sb.append(runBashCommand("DISK STORAGE", "df -h"));
		return sb.toString();
	}

	public String getSessionActivity() {
		StringBuilder sb = new StringBuilder();
		sb.append("Live Sessions:\n");

		List<SessionContext> sessions = SessionContext.getHistoricalSessions();
		sessions.sort((s1, s2) -> {
			String s1key = s1.getUserName() + "/" + (s1.getIp() == null ? "?" : s1.getIp());
			String s2key = s2.getUserName() + "/" + (s2.getIp() == null ? "?" : s2.getIp());
			return s1key.compareTo(s2key);
		});

		for (SessionContext s : sessions) {
			if (s.isLive()) {
				sb.append("User: ");
				sb.append(s.getUserName() + "/" + (s.getIp() == null ? "?" : s.getIp()));
				sb.append("\n");
				sb.append(s.dumpActions("      ", 3));
			}
		}

		sb.append("\nPast Sessions:\n");
		for (SessionContext s : sessions) {
			if (!s.isLive()) {
				sb.append("User: ");
				sb.append(s.getPastUserName() + "/" + (s.getIp() == null ? "?" : s.getIp()));
				sb.append("\n");
				sb.append(s.dumpActions("      ", 3));
			}
		}
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
		return "Number of Unique IPs since startup: " + HitFilter.getUniqueIpHits().size() + "\n";
		// StringBuilder sb = new StringBuilder();
		// sb.append("Unique IPs During Run<br>");
		// int count = 0;
		// HashMap<String, Integer> map = HitFilter.getUniqueIpHits();
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
