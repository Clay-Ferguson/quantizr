package quanta.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;

/**
 * Manages the node where we store all emails that are queued up to be sent.
 * 
 * The system always sends emails out in a batch operation every 30seconds or so, by emptying out
 * this queue.
 */
@Component
public class OutboxMgr extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(OutboxMgr.class);
    private String mailBatchSize = "10";
    private static SubNode outboxNode = null;
    private static final Object outboxLock = new Object();

    /**
     * Sends an email notification to the user associated with 'toUserNode' (a person's account root
     * node), telling them that 'fromUserName' has shared a node with them, and including a link to the
     * shared node in the email.
     */
    public void sendEmailNotification(MongoSession ms, String fromUserName, SubNode toUserNode, SubNode node) {
        String email = toUserNode.getStr(NodeProp.EMAIL);
        String toUserName = toUserNode.getStr(NodeProp.USER);
        String nodeUrl = snUtil.getFriendlyNodeUrl(ms, node);
        String content = String.format(
                prop.getConfigText("brandingAppName") + " user '%s' shared a node to your '%s' account.<p>\n\n" + //
                        "%s",
                fromUserName, toUserName, nodeUrl);
        queueMail(ms, email, "A " + prop.getConfigText("brandingAppName") + " Node was shared to you!", content);
    }

    public void queueEmail(String recipients, String subject, String content) {
        arun.run(as -> {
            queueMail(as, recipients, subject, content);
            return null;
        });
    }

    private void queueMail(MongoSession ms, String recipients, String subject, String content) {
        SubNode outboxNode = getSystemOutbox(ms);
        SubNode outboundEmailNode = create.createNode(ms, outboxNode.getPath() + "/?", NodeType.NONE.s());
        outboundEmailNode.setOwner(ms.getUserNodeId());
        outboundEmailNode.set(NodeProp.EMAIL_CONTENT, content);
        outboundEmailNode.set(NodeProp.EMAIL_SUBJECT, subject);
        outboundEmailNode.set(NodeProp.EMAIL_RECIP, recipients);
        update.save(ms, outboundEmailNode);
        email.setOutboxDirty();
    }

    /*
     * Loads only up to mailBatchSize emails at a time
     */
    public Iterable<SubNode> getMailNodes(MongoSession ms) {
        SubNode outboxNode = getSystemOutbox(ms);
        int mailBatchSizeInt = Integer.parseInt(mailBatchSize);
        return read.getChildren(ms, outboxNode, null, mailBatchSizeInt, 0, false);
    }

    public SubNode getSystemOutbox(MongoSession ms) {
        if (OutboxMgr.outboxNode != null) {
            return OutboxMgr.outboxNode;
        }
        synchronized (outboxLock) {
            // yep it's correct threading to check the node value again once inside the lock
            if (OutboxMgr.outboxNode != null) {
                return OutboxMgr.outboxNode;
            }
            snUtil.ensureNodeExists(ms, NodePath.ROOT_PATH, NodePath.OUTBOX, "Outbox", null, true, null, null);
            OutboxMgr.outboxNode = snUtil.ensureNodeExists(ms, NodePath.ROOT_PATH,
                    NodePath.OUTBOX + "/" + NodePath.SYSTEM, "System Messages", null, true, null, null);
            return OutboxMgr.outboxNode;
        }
    }
}
