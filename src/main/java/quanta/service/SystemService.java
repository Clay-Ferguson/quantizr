package quanta.service;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.mongodb.client.MongoDatabase;
import quanta.config.AppSessionListener;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.UserStats;
import quanta.model.client.Attachment;
import quanta.model.ipfs.file.IPFSObjectStat;
import quanta.mongo.MongoAppConfig;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.redis.RedisBrowserPushInfo;
import quanta.response.ServerPushInfo;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;
import quanta.util.TreeNode;
import quanta.util.XString;

/**
 * Service methods for System related functions. Admin functions.
 */
@Component
public class SystemService extends ServiceBase {

    private static Logger log = LoggerFactory.getLogger(SystemService.class);
    private static final Random rand = new Random();
    private static final int replicaId = rand.nextInt(Integer.MAX_VALUE);

    // These two cache collections are for the purpose of being sure that almost all browsing
    // of the admin content (landing page, website) can be done without any DB querying at all and
    // come directly from server memory.
    public static final Object adminNodesCacheLock = new Object();
    public TreeNode adminNodesCache;
    public HashMap<String, TreeNode> adminNodesCacheMap;
    private static long lastCacheAdminNodesTime = 0;
    public static long lastAdminOwnedSaveTime = 0;

    /*
     * Every 5mins check if latest admin-owned node save time is after last cacheAdminNodes call time
     * then force a recache now
     */
    @Scheduled(fixedDelay = 5 * DateUtil.MINUTE_MILLIS)
    public void autoCacheAdminNodes() {
        if (lastCacheAdminNodesTime > 0 && lastAdminOwnedSaveTime > 0
                && lastAdminOwnedSaveTime > lastCacheAdminNodesTime) {
            cacheAdminNodes();
        }
    }

    public void cacheAdminNodes() {
        arun.run(as -> {
            String id = prop.getUserLandingPageNode();
            SubNode node = read.getNode(as, id, false);
            if (node != null) {
                synchronized (adminNodesCacheLock) {
                    adminNodesCacheMap = new HashMap<String, TreeNode>();
                    adminNodesCache = read.getSubGraphTree(as, node.getIdStr(), null, adminNodesCacheMap);
                    lastCacheAdminNodesTime = System.currentTimeMillis();
                }
            }
            return null;
        });
    }

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
     * create orphans by deleting a node and expecting all it's orphans to stay there and we can test if
     * our orphan deleter can delete them.
     */
    public String deleteLeavingOrphans(MongoSession ms, String nodeId) {
        SubNode node = read.getNode(ms, nodeId);
        delete.delete(ms, node);
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
        } finally {
            //
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
                // todo-1: ipfs temporarily disabled due to refactoring.
                // ret += ipfsGarbageCollect(statsMap);
            }
            arun.run(as -> {
                user.writeUserStats(as, statsMap);
                return null;
            });
            ret += runMongoDbCommand(MongoAppConfig.databaseName, new Document("compact", "nodes"));
            ret += "\n\nRemember to Rebuild Indexes next. Or else the system can be slow.";
        } finally {
            //
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

    // https://docs.mongodb.com/manual/reference/command/validate/
    // db.runCommand(
    // {
    // validate: <string>, // Collection name
    // full: <boolean>, // Optional
    // repair: <boolean>, // Optional, added in MongoDB 5.0
    // metadata: <boolean> // Optional, added in MongoDB 5.0.4
    // })
    public String validateDb() {
        String ret = "validate: " + runMongoDbCommand(MongoAppConfig.databaseName,
                new Document("validate", "nodes").append("full", true));
        ret += "\n\ndbStats: "
                + runMongoDbCommand(MongoAppConfig.databaseName, new Document("dbStats", 1).append("scale", 1024));
        ret += "\n\nusersInfo: " + runMongoDbCommand("admin", new Document("usersInfo", 1));
        if (prop.ipfsEnabled()) {
            ret += ipfsRepo.verify();
            ret += ipfsPin.verify();
        }
        return ret;
    }

    public String repairDb() {
        update.runRepairs();
        return "Repair completed ok.";
    }

    public String runMongoDbCommand(String dbName, Document doc) {
        // NOTE: Use "admin" as databse name to run admin commands like changeUserPassword
        MongoDatabase database = mdbf.getMongoDatabase(dbName);
        Document result = database.runCommand(doc);
        return XString.prettyPrint(result);
    }

    public static void logMemory() {
        // Runtime runtime = Runtime.getRuntime();
        // long freeMem = runtime.freeMemory() / ONE_MB;
        // long maxMem = runtime.maxMemory() / ONE_MB;
        // log.info(String.format("GC Cycle. FreeMem=%dMB, MaxMem=%dMB", freeMem,
        // maxMem));
    }

    public String getJson(MongoSession ms, String nodeId) {
        SubNode node = read.getNode(ms, nodeId, true, null);
        if (node != null) {
            String ret = XString.prettyPrint(node);
            List<Attachment> atts = node.getOrderedAttachments();
            if (atts != null) {
                for (Attachment att : atts) {
                    if (att.getIpfsLink() != null) {
                        IPFSObjectStat fullStat = ipfsObj.objectStat(att.getIpfsLink(), false);
                        if (fullStat != null) {
                            ret += "\n\nIPFS Object Stats:\n" + XString.prettyPrint(fullStat);
                        }
                    }
                }
            }
            if (ms.isAdmin()) {
                ret += "\n\n";
                ret += "English: " + (english.isEnglish(node.getContent()) ? "Yes" : "No") + "\n";
                ret += "Profanity: " + (english.hasBadWords(node.getContent()) ? "Yes" : "No") + "\n";
            }
            return ret;
        } else {
            return "node not found!";
        }
    }

    public String getSystemInfo() {
        StringBuilder sb = new StringBuilder();
        sb.append("Ver: " + prop.getAppVersion() + "\n");
        sb.append("Replica ID: " + SystemService.replicaId + "\n");
        sb.append("AuditFilter Enabed: " + String.valueOf(AppFilter.audit) + "\n");
        sb.append("Daemons Enabed: " + String.valueOf(prop.isDaemonsEnabled()) + "\n");

        sb.append(pgSvc.getInfo());
        sb.append(oai.getOpenAiStats(null, null));
        sb.append(getRedisReport());
        sb.append("HttpSessions: " + AppSessionListener.sessionCounter + "\n");

        Runtime runtime = Runtime.getRuntime();
        runtime.gc();
        long freeMem = runtime.freeMemory() / Const.ONE_MB;
        sb.append(String.format("Server Free Mem: %dMB\n", freeMem));

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

        sb.append("\nEnvironment Vars:\n");
        sb.append(getEnvironment());

        // Run command inside container
        // sb.append(runBashCommand("DISK STORAGE (Docker Container)", "df -h"));
        return sb.toString();
    }

    public String getRedisReport() {
        StringBuilder sb = new StringBuilder();
        sb.append("\nUser Sessions (Redis): \n");
        List<SessionContext> list = redis.query("*");
        for (SessionContext sc : list) {
            sb.append("    " + sc.getUserName() + " " + sc.getUserToken() + "\n");
        }
        sb.append("\n");
        return sb.toString();
    }

    public String getEnvironment() {
        Map<String, String> env = System.getenv();
        LinkedList<String> envList = new LinkedList<String>();
        env.forEach((k, v) -> {
            if (k.toLowerCase().contains("pass"))
                return;
            envList.add(k + ":" + v + "\n");
        });
        envList.sort(null);
        StringBuilder sb = new StringBuilder();
        envList.forEach(v -> sb.append(v));
        return sb.toString();
    }

    public String redisPubSubTest() {
        ServerPushInfo info = new ServerPushInfo("DummyInfo JSON");
        RedisBrowserPushInfo msg =
                new RedisBrowserPushInfo("FAKE_TOKEN", XString.compactPrint(info), info.getClass().getName());
        redis.publish(msg);
        return ("Redis PubSub Published: " + XString.prettyPrint(msg));
    }
}
