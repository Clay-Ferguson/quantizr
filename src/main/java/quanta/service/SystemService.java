package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.servlet.http.HttpSession;
import com.mongodb.client.MongoDatabase;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.AppController;
import quanta.config.AppSessionListener;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.filter.AuditFilter;
import quanta.filter.HitFilter;
import quanta.model.UserStats;
import quanta.model.client.NodeProp;
import quanta.model.ipfs.file.IPFSObjectStat;
import quanta.mongo.MongoAppConfig;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.PushPageMessage;
import quanta.util.Const;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Service methods for System related functions. Admin functions.
 */

@Component
public class SystemService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(SystemService.class);

	public String rebuildIndexes() {
		ThreadLocals.requireAdmin();

		arun.run(as -> {
			mongoUtil.rebuildIndexes(as);
			return null;
		});
		return "success.";
	}

	/*
	 * This was created to make it easier to test the orphan handling functions, so we can intentionally
	 * create orphans
	 */
	public String deleteLeavingOrphans(MongoSession ms, String nodeId) {
		SubNode node = read.getNode(ms, nodeId);
		delete.delete(node);
		return "Success.";
	}

	public String runConversion() {
		String ret = "";
		try {
			prop.setDaemonsEnabled(false);

			arun.run(as -> {
				// different types of database conversions can be put here as needed
				// mongoUtil.fixSharing(ms);
				return null;
			});
			ret = "Completed ok.";
		} //
		finally {
			prop.setDaemonsEnabled(true);
		}
		return ret;
	}

	public String compactDb() {
		String ret = "";
		try {
			prop.setDaemonsEnabled(false);

			delete.deleteNodeOrphans();
			// do not delete.
			// usrMgr.cleanUserAccounts();

			/*
			 * Create map to hold all user account storage statistics which gets updated by the various
			 * processing in here and then written out in 'writeUserStats' below
			 */
			final HashMap<ObjectId, UserStats> statsMap = new HashMap<>();

			attach.gridMaintenanceScan(statsMap);

			if (prop.ipfsEnabled()) {
				ret = ipfsGarbageCollect(statsMap);
			}

			arun.run(as -> {
				user.writeUserStats(as, statsMap);
				return null;
			});

			ret += runMongoDbCommand(new Document("compact", "nodes"));
		}
		//
		finally {
			prop.setDaemonsEnabled(true);
		}
		return ret;
	}

	public String ipfsGarbageCollect(HashMap<ObjectId, UserStats> statsMap) {
		if (!prop.ipfsEnabled())
			return "IPFS Disabled.";
		String ret = ipfsRepo.gc();
		ret += update.releaseOrphanIPFSPins(statsMap);
		return ret;
	}

	public String validateDb() {
		// https://docs.mongodb.com/manual/reference/command/validate/
		String ret = runMongoDbCommand(new Document("validate", "nodes").append("full", true));

		if (prop.ipfsEnabled()) {
			ret += ipfsRepo.verify();
			ret += ipfsPin.verify();
		}
		return ret;
	}

	public String runMongoDbCommand(Document doc) {
		MongoDatabase database = mdbf.getMongoDatabase(MongoAppConfig.databaseName);
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
		if (ok(node)) {
			String ret = XString.prettyPrint(node);

			String ipfsLink = node.getStr(NodeProp.IPFS_LINK);
			if (ok(ipfsLink)) {
				IPFSObjectStat fullStat = ipfsObj.objectStat(ipfsLink, false);
				if (ok(fullStat)) {
					ret += "\n\nIPFS Object Stats:\n" + XString.prettyPrint(fullStat);
				}
			}

			if (ms.isAdmin()) {
				ret += "\n\n";
				ret += "English: " + (english.isEnglish(node.getContent(), 0.50f) ? "Yes" : "No") + "\n";
				ret += "Profanity: " + (english.hasBadWords(node.getContent()) ? "Yes" : "No") + "\n";
			}

			return ret;
		} else {
			return "node not found!";
		}
	}

	public String getSystemInfo() {
		StringBuilder sb = new StringBuilder();
		sb.append("AuditFilter Enabed: " + String.valueOf(AuditFilter.enabled) + "\n");
		sb.append("Daemons Enabed: " + String.valueOf(prop.isDaemonsEnabled()) + "\n");
		Runtime runtime = Runtime.getRuntime();
		runtime.gc();
		long freeMem = runtime.freeMemory() / Const.ONE_MB;
		sb.append(String.format("Server Free Mem: %dMB\n", freeMem));
		sb.append(String.format("Sessions: %d\n", AppSessionListener.getSessionCounter()));
		sb.append(getSessionReport());
		sb.append("Node Count: " + read.getNodeCount() + "\n");
		sb.append("Attachment Count: " + attach.getGridItemCount() + "\n");
		sb.append(user.getUserAccountsReport(null));

		sb.append(apub.getStatsReport());

		if (!StringUtils.isEmpty(prop.getIPFSApiHostAndPort())) {
			sb.append(ipfsConfig.getStat());
		}

		RuntimeMXBean runtimeMxBean = ManagementFactory.getRuntimeMXBean();
		List<String> arguments = runtimeMxBean.getInputArguments();
		sb.append("\nJava VM args:\n");
		for (String arg : arguments) {
			sb.append(arg + "\n");
		}

		// Run command inside container
		// sb.append(runBashCommand("DISK STORAGE (Docker Container)", "df -h"));
		return sb.toString();
	}

	// For now this is for server restart notify, but will eventually be a general broadcast messenger.
	// work in progress.
	public String sendAdminNote() {
		int sessionCount = 0;
		for (SessionContext sc : SessionContext.getAllSessions(false, true)) {
			HttpSession httpSess = ThreadLocals.getHttpSession();
			log.debug("Send admin note to: " + sc.getUserName() + " sessId: " + httpSess.getId());
			// need custom messages support pushed by admin
			push.sendServerPushInfo(sc,
					new PushPageMessage("Server " + prop.getMetaHost()
							+ "  will restart for maintenance soon.<p><p>When you get an error, just refresh your browser.",
							true));
			sessionCount++;
		}

		return String.valueOf(sessionCount) + " sessions notified.";
	}

	public String getSessionActivity() {
		StringBuilder sb = new StringBuilder();

		List<SessionContext> sessions = SessionContext.getHistoricalSessions();
		sessions.sort((s1, s2) -> {
			String s1key = s1.getUserName();
			String s2key = s2.getUserName();
			return s1key.compareTo(s2key);
		});

		sb.append("Live Sessions:\n");
		for (SessionContext s : sessions) {
			if (s.isLive()) {
				sb.append("User: ");
				sb.append(s.getUserName());
				sb.append("\n");
				sb.append(s.dumpActions("      ", 3));
			}
		}

		sb.append("\nPast Sessions:\n");
		for (SessionContext s : sessions) {
			if (!s.isLive()) {
				sb.append("User: ");
				sb.append(s.getPastUserName());
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
		output.append("\n\n");
		output.append(title);
		output.append("\n");

		try {
			Process p = pb.start();
			String s;

			BufferedReader stdout = new BufferedReader(new InputStreamReader(p.getInputStream()));
			while (ok(s = stdout.readLine())) {
				output.append(s);
				output.append("\n");
			}

			// output.append("Exit value: " + p.waitFor());
			// p.getInputStream().close();
			// p.getOutputStream().close();
			// p.getErrorStream().close();
		} catch (Exception e) {
			ExUtil.error(log, "Unable to run script", e);
		}
		output.append("\n\n");
		return output.toString();
	}

	/*
	 * uniqueIps are all IPs even comming from foreign FediverseServers, but uniqueUserIps are the ones
	 * that represent actual users accessing thru their browsers
	 */
	private static String getSessionReport() {
		StringBuilder sb = new StringBuilder();
		sb.append("All Sessions (over 10 hits): " + HitFilter.getHits().size() + "\n");
		HashMap<String, Integer> map = HitFilter.getHits();
		synchronized (map) {
			for (String key : map.keySet()) {
				int hits = map.get(key);
				if (hits > 10) {
					sb.append("    " + key + " hits=" + hits + "\n");
				}
			}
		}
		sb.append("User Sessions: " + AppController.uniqueUserIpHits.size() + "\n");

		sb.append("Live Sessions:\n");
		for (SessionContext sc : SessionContext.getAllSessions(false, true)) {
			if (sc.isLive() && ok(sc.getUserName())) {
				Integer hits = map.get(sc.getSession().getId());
				sb.append("    " + sc.getUserName() + " hits=" + (ok(hits) ? String.valueOf(hits) : "?"));
				sb.append("\n");
			}
		}
		sb.append("\n");

		return sb.toString();
	}
}
