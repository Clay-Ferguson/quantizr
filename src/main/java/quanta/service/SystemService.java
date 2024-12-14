package quanta.service;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.apache.commons.lang3.StringUtils;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.mongodb.client.MongoDatabase;
import quanta.config.AppSessionListener;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.exception.base.RuntimeEx;
import quanta.mongo.MongoAppConfig;
import quanta.mongo.model.SubNode;
import quanta.perf.PerformanceReport;
import quanta.redis.RedisBrowserPushInfo;
import quanta.rest.request.ExportRequest;
import quanta.rest.request.GetServerInfoRequest;
import quanta.rest.request.SendLogTextRequest;
import quanta.rest.response.ExportResponse;
import quanta.rest.response.GetServerInfoResponse;
import quanta.rest.response.InfoMessage;
import quanta.rest.response.PingResponse;
import quanta.rest.response.SendLogTextResponse;
import quanta.rest.response.SendTestEmailResponse;
import quanta.rest.response.ServerPushInfo;
import quanta.service.exports.ExportServicePDF;
import quanta.service.exports.ExportTarService;
import quanta.service.exports.ExportZipService;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.TL;
import quanta.util.XString;

/**
 * Service methods for System related functions. Admin functions.
 */
@Component
public class SystemService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(SystemService.class);
    private static final Random rand = new Random();
    private static final int replicaId = rand.nextInt(Integer.MAX_VALUE);

    public String rebuildIndexes() {
        TL.requireAdmin();
        svc_arun.run(() -> {
            svc_mongoUtil.rebuildIndexes();
            return null;
        });
        return "success.";
    }

    public String runConversion() {
        String ret = "";
        try {
            svc_prop.setDaemonsEnabled(false);
            svc_arun.run(() -> {
                // different types of database conversions can be put here as needed
                // mongoUtil.fixSharing(ms);
                return null;
            });
            ret = "Completed ok.";
        } finally {
            svc_prop.setDaemonsEnabled(true);
        }
        return ret;
    }

    int maintenanceRunCount = 0;

    // every 4 hours run a grid maintenance scan
    @Scheduled(fixedDelay = 3 * DateUtil.HOUR_MILLIS)
    public void runScheduledMaintenance() {
        if (++maintenanceRunCount == 1)
            return; // skip first run, which triggers at startup
        svc_arun.run(() -> {
            svc_mongoTrans.gridMaintenanceScan();
            return null;
        });
    }

    // Returns markdown text with results of cleanup operations
    public String cleanupDb() {
        String ret = "`Remember to Rebuild Indexes!`\n\n";
        try {
            svc_prop.setDaemonsEnabled(false);
            ret += svc_mongoTrans.deleteNodeOrphans();
            ret += svc_mongoTrans.gridMaintenanceScan();
            ret += svc_attach.verifyAllAttachments();

            ret += "\n## MongoDB Compact: nodes collection\n";
            ret += runMongoDbCommand(MongoAppConfig.databaseName,
                    new Document("compact", "nodes").append("force", true));

        } finally {
            svc_prop.setDaemonsEnabled(true);
        }
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
        // String ret = "validate: " + runMongoDbCommand(MongoAppConfig.databaseName,
        // new Document("validate", "nodes").append("full", true).append("repair", true));

        // Note: we get an error message with repair=true (commented out above), which I think is because
        // we're now in a replica set mode.
        String ret = "\n## Validate DB\n" + runMongoDbCommand(MongoAppConfig.databaseName,
                new Document("validate", "nodes").append("full", true));

        ret += "\n## DB Statistics\n"
                + runMongoDbCommand(MongoAppConfig.databaseName, new Document("dbStats", 1).append("scale", 1024));

        ret += "\n## DB Users Info\n" + runMongoDbCommand("admin", new Document("usersInfo", 1));
        return ret;
    }

    public String repairDb() {
        svc_mongoUpdate.resetChildrenState();
        return "Repair completed ok.";
    }

    public String runMongoDbCommand(String dbName, Document doc) {
        // NOTE: Use "admin" as databse name to run admin commands like changeUserPassword
        MongoDatabase database = svc_mdbf.getMongoDatabase(dbName);
        Document result = database.runCommand(doc);
        return "\n```json\n" + XString.prettyPrint(result) + "\n```\n";
    }

    public String getJson(String nodeId) {
        SubNode node = svc_mongoRead.getNode(nodeId);
        if (node != null) {
            String ret = XString.prettyPrint(node);
            return ret;
        } else {
            return "node not found!";
        }
    }

    public String getSystemInfo() {
        StringBuilder sb = new StringBuilder();

        sb.append("## Server Config\n");
        sb.append("\n```\n");
        sb.append("Ver: " + svc_prop.getAppVersion() + "\n");
        sb.append("Replica ID: " + SystemService.replicaId + "\n");
        sb.append("AuditFilter Enabed: " + String.valueOf(AppFilter.audit) + "\n");
        sb.append("Daemons Enabed: " + String.valueOf(svc_prop.isDaemonsEnabled()) + "\n");
        sb.append("\n```\n");

        sb.append(getRedisReport());

        Runtime runtime = Runtime.getRuntime();
        runtime.gc();
        long freeMem = runtime.freeMemory() / Const.ONE_MB;

        sb.append("## Server Stats\n");
        sb.append("\n```\n");
        sb.append("HttpSessions: " + AppSessionListener.sessionCounter + "\n");
        sb.append("Node Count: " + svc_mongoRead.getNodeCount() + "\n");
        sb.append("Binary Grid Item Count: " + svc_attach.getGridItemCount() + "\n");
        sb.append(String.format("Server Free Mem: %dMB\n", freeMem));
        sb.append("\n```\n");

        sb.append(svc_user.getUserAccountsReport());

        sb.append("## VM Args\n");
        sb.append("\n```\n");
        RuntimeMXBean runtimeMxBean = ManagementFactory.getRuntimeMXBean();
        List<String> arguments = runtimeMxBean.getInputArguments();
        for (String arg : arguments) {
            sb.append(arg + "\n");
        }
        sb.append("\n```\n");

        sb.append("## RSS Feed Status\n```\n" + svc_rssFeed.getFeedStatus() + "\n```\n");

        sb.append("## Environment Vars\n");
        sb.append("\n```\n");
        sb.append(getEnvironment());
        sb.append("\n```\n");

        // Run command inside container
        // sb.append(runBashCommand("DISK STORAGE (Docker Container)", "df -h"));
        return sb.toString();
    }

    public String getRedisReport() {
        StringBuilder sb = new StringBuilder();
        sb.append("## User Sessions (Redis)\n");
        sb.append("\n```\n");
        List<SessionContext> list = svc_redis.query("*");
        for (SessionContext sc : list) {
            sb.append(sc.getUserName() + " " + sc.getUserToken() + "\n");
        }
        sb.append("\n```\n");
        return sb.toString();
    }

    public String getEnvironment() {
        Map<String, String> env = System.getenv();
        LinkedList<String> envList = new LinkedList<String>();
        env.forEach((k, v) -> {
            if (k.toLowerCase().contains("pass") || k.endsWith("_API_KEY"))
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
        svc_redis.publish(msg);
        return ("Redis PubSub Published: " + XString.prettyPrint(msg));
    }

    public Object cm_export(ExportRequest req) {
        ExportResponse res = new ExportResponse();

        svc_arun.run(() -> {
            SubNode node = svc_mongoRead.getNode(req.getNodeId());
            if (node == null)
                throw new RuntimeEx("Node not found: " + req.getNodeId());
            if (!svc_auth.ownedByThreadUser(node)) {
                throw new RuntimeEx("You can only export nodes you own");
            }
            return null;
        });

        if ("pdf".equalsIgnoreCase(req.getExportExt())) {
            ExportServicePDF svc = (ExportServicePDF) context.getBean(ExportServicePDF.class);
            svc.export(req, res);
        } else if ("zip".equalsIgnoreCase(req.getExportExt())) {
            ExportZipService svc = (ExportZipService) context.getBean(ExportZipService.class);
            svc.export(req, res);
        } //
        else if ("tar".equalsIgnoreCase(req.getExportExt())) {
            ExportTarService svc = (ExportTarService) context.getBean(ExportTarService.class);
            svc.export(req, res);
        } //
        else if ("tar.gz".equalsIgnoreCase(req.getExportExt())) {
            ExportTarService svc = (ExportTarService) context.getBean(ExportTarService.class);
            svc.setUseGZip(true);
            svc.export(req, res);
        } else {
            throw new RuntimeEx("Unsupported file extension: " + req.getExportExt());
        }
        return res;
    }

    public Object cm_getServerInfo(GetServerInfoRequest req) {
        GetServerInfoResponse res = new GetServerInfoResponse();
        res.setFormat("txt"); // default to plain text format
        res.setMessages(new LinkedList<>());
        if (req.getCommand().equalsIgnoreCase("getJson")) {
        } else { // allow this one if user owns node.
            TL.requireAdmin();
        }

        log.debug("Command: " + req.getCommand());
        switch (req.getCommand()) {
            case "getTestResults":
                if ("run".equals(req.getParameter())) {
                    svc_testUtil.setTestResults(new StringBuilder());
                    svc_testUtil.runTests();
                }
                res.getMessages().add(new InfoMessage(svc_testUtil.getTestResults().toString(), null));
                break;
            case "redisPubSubTest":
                res.getMessages().add(new InfoMessage(svc_system.redisPubSubTest(), null));
                break;
            case "performanceReport":
                res.setFormat("html");
                res.getMessages().add(new InfoMessage(PerformanceReport.getReport(), null));
                break;
            case "transactionsReport":
                res.setFormat("html");
                res.getMessages().add(new InfoMessage(svc_financialReport.getReport(), null));
                break;
            case "clearPerformanceData":
                res.getMessages().add(new InfoMessage(PerformanceReport.clearData(), null));
                break;
            case "cleanupDb":
                res.setFormat("md");
                res.getMessages().add(new InfoMessage(svc_system.cleanupDb(), null));
                break;
            case "runConversion":
                res.getMessages().add(new InfoMessage(svc_system.runConversion(), null));
                break;
            case "validateDb":
                res.setFormat("md");
                res.getMessages().add(new InfoMessage(svc_system.validateDb(), null));
                break;
            case "repairDb":
                res.getMessages().add(new InfoMessage(svc_system.repairDb(), null));
                break;
            case "rebuildIndexes":
                res.getMessages().add(new InfoMessage(svc_system.rebuildIndexes(), null));
                break;
            case "refreshRssCache":
                res.getMessages().add(new InfoMessage(svc_rssFeed.refreshFeedCache(), null));
                break;
            case "toggleAuditFilter":
                AppFilter.audit = !AppFilter.audit;
                res.getMessages().add(new InfoMessage(svc_system.getSystemInfo(), null));
                break;
            case "toggleDaemons":
                svc_prop.setDaemonsEnabled(!svc_prop.isDaemonsEnabled());
                res.getMessages().add(new InfoMessage(svc_system.getSystemInfo(), null));
                break;
            case "getServerInfo":
                res.setFormat("md");
                res.getMessages().add(new InfoMessage(svc_system.getSystemInfo(), null));
                break;
            case "getJson":
                res.getMessages().add(new InfoMessage(svc_system.getJson(req.getNodeId()), null));
                break;
            default:
                throw new RuntimeEx("Invalid command: " + req.getCommand());
        }
        return res;
    }

    public String cm_getHealth() {
        return "Health Check\n\n" + //
                "Ver: " + svc_prop.getAppVersion() + "\n" + //
                "Server Time: " + System.currentTimeMillis() + "\n" + //
                "Swarm Task Id: " + svc_prop.getSwarmTaskId() + "\n" + //
                "slot: " + svc_prop.getSwarmTaskSlot();
    }

    /*
     * Used to keep session from timing out when browser is doing something long-running like playing an
     * audio file, and the user may not be interacting at all.
     */
    public Object cm_ping() {
        PingResponse res = new PingResponse();
        res.setServerInfo("Server: t=" + System.currentTimeMillis() + " SwarmTaskId=" + svc_prop.getSwarmTaskId());
        return res;
    }

    public Object cm_sendTestEmail() {
        SendTestEmailResponse res = new SendTestEmailResponse();
        TL.requireAdmin();
        log.debug("SendEmailTest detected on server.");
        String timeString = new Date().toString();
        synchronized (EmailService.getLock()) {
            String devEmail = svc_prop.getDevEmail();
            String fromAddress = svc_prop.getMailFrom();
            svc_email.sendMail(devEmail, fromAddress,
                    "<h1>Hello! Time=" + timeString + "</h1>This is the test email requested from the "
                            + svc_prop.getConfigText("brandingAppName") + " admin menu.",
                    "Test Subject");
        }
        return res;
    }

    public Object cm_sendLogText(SendLogTextRequest req) {
        TL.requireAdmin();
        SendLogTextResponse res = new SendLogTextResponse();
        log.debug("DEBUG: " + req.getText());
        log.info("INFO: " + req.getText());
        log.trace("TRACE: " + req.getText());
        return res;
    }

    public SseEmitter cm_serverPush(String token) {
        if (StringUtils.isEmpty(token)) {
            throw new RuntimeEx("No token for serverPush");
        }

        SessionContext sc = svc_redis.get(token);
        if (sc == null) {
            // todo-2: We were getting this a LOT in the log file, just from outdated sessions (i think) so
            // let's ignore it for now.
            // throw new RuntimeEx("bad token for push emitter: " + token);
            return null;
        }

        SseEmitter emitter = svc_user.getPushEmitter(token);
        if (emitter == null) {
            throw new RuntimeEx("Failed getting emitter for token: " + token);
        }
        return emitter;
    }
}
