package quanta.mail;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import quanta.config.AppProp;
import quanta.config.NodeName;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.response.NotificationMessage;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Manages the node where we store all emails that are queued up to be sent.
 * <p>
 * The system always sends emails out in a batch operation every 30seconds or so, by emptying out
 * this queue.
 * 
 */
@Component
public class OutboxMgr extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(OutboxMgr.class);

	@Autowired
    private AppProp prop;

	private String mailBatchSize = "10";
	private static SubNode outboxNode = null;
	private static final Object outboxLock = new Object();

	/**
	 * Adds a node into the user's "Inbox" as an indicator to them that the 'node' added needs their
	 * attention, for some reason or that someone has shared this node with them.
	 */
	public void addInboxNotification(String recieverUserName, SubNode userNode, SubNode node, String notifyMessage) {

		arun.run(session -> {
			SubNode userInbox =
					read.getUserNodeByType(session, null, userNode, "### Inbox", NodeType.INBOX.s(), null, NodeName.INBOX);

			if (ok(userInbox)) {
				// log.debug("userInbox id=" + userInbox.getIdStr());

				/*
				 * First look to see if there is a target node already existing in this persons inbox that points to
				 * the node in question
				 */
				SubNode notifyNode = read.findNodeByProp(session, userInbox, NodeProp.TARGET_ID.s(), node.getIdStr());

				/*
				 * If there's no notification for this node already in the user's inbox then add one
				 */
				if (no(notifyNode)) {
					notifyNode = create.createNode(session, userInbox, null, NodeType.INBOX_ENTRY.s(), 0L,
							CreateNodeLocation.FIRST, null, null, true);

					// trim to 280 like twitter.
					String shortContent = XString.trimToMaxLen(node.getContent(), 280) + "...";
					String content = String.format("#### New from: %s\n%s", ThreadLocals.getSC().getUserName(), shortContent);

					notifyNode.setOwner(userInbox.getOwner());
					notifyNode.setContent(content);
					notifyNode.touch();
					notifyNode.set(NodeProp.TARGET_ID.s(), node.getIdStr());
					update.save(session, notifyNode);
				}

				/*
				 * Send push notification so the user sees live there's a new share comming in or being re-added
				 * even.
				 */
				List<SessionContext> scList = SessionContext.getSessionsByUserName(recieverUserName);
				if (ok(scList)) {
					for (SessionContext sc : scList) {
						push.sendServerPushInfo(sc,
								// todo-2: fill in the two null parameters here if/when you ever bring this method back.
								new NotificationMessage("newInboxNode", node.getIdStr(), "New node shared to you.",
										ThreadLocals.getSC().getUserName()));
					}
				}
			}
			return null;
		});
	}

	/**
	 * Sends an email notification to the user associated with 'toUserNode' (a person's account root
	 * node), telling them that 'fromUserName' has shared a node with them, and including a link to the
	 * shared node in the email.
	 */
	public void sendEmailNotification(MongoSession ms, String fromUserName, SubNode toUserNode, SubNode node) {
		String email = toUserNode.getStr(NodeProp.EMAIL.s());
		String toUserName = toUserNode.getStr(NodeProp.USER.s());
		// log.debug("sending node notification email to: " + email);

		String nodeUrl = snUtil.getFriendlyNodeUrl(ms, node);
		String content =
				String.format(prop.getConfigText("brandingAppName") + " user '%s' shared a node to your '%s' account.<p>\n\n" + //
						"%s", fromUserName, toUserName, nodeUrl);

		queueMail(ms, email, "A " + prop.getConfigText("brandingAppName") + " Node was shared to you!", content);
	}

	public void queueEmail(String recipients, String subject, String content) {
		arun.run(session -> {
			queueMail(session, recipients, subject, content);
			return null;
		});
	}

	private void queueMail(MongoSession ms, String recipients, String subject, String content) {
		SubNode outboxNode = getSystemOutbox(ms);
		SubNode outboundEmailNode = create.createNode(ms, outboxNode.getPath() + "/?", NodeType.NONE.s());

		outboundEmailNode.setOwner(ms.getUserNodeId());
		outboundEmailNode.set(NodeProp.EMAIL_CONTENT.s(), content);
		outboundEmailNode.set(NodeProp.EMAIL_SUBJECT.s(), subject);
		outboundEmailNode.set(NodeProp.EMAIL_RECIP.s(), recipients);

		update.save(ms, outboundEmailNode);
		notify.setOutboxDirty();
	}

	/*
	 * Loads only up to mailBatchSize emails at a time
	 */
	public List<SubNode> getMailNodes(MongoSession ms) {
		SubNode outboxNode = getSystemOutbox(ms);
		// log.debug("outbox id: " + outboxNode.getIdStr());

		int mailBatchSizeInt = Integer.parseInt(mailBatchSize);
		return read.getChildrenAsList(ms, outboxNode, false, mailBatchSizeInt);
	}

	public SubNode getSystemOutbox(MongoSession ms) {
		if (ok(OutboxMgr.outboxNode)) {
			return OutboxMgr.outboxNode;
		}

		synchronized (outboxLock) {
			// yep it's correct threading to check the node value again once inside the lock
			if (ok(OutboxMgr.outboxNode)) {
				return OutboxMgr.outboxNode;
			}

			snUtil.ensureNodeExists(ms, "/" + NodePath.ROOT, NodePath.OUTBOX, null, "Outbox", null, true, null, null);

			OutboxMgr.outboxNode = snUtil.ensureNodeExists(ms, "/" + NodePath.ROOT, NodePath.OUTBOX + "/" + NodePath.SYSTEM, null,
					"System Messages", null, true, null, null);
			return OutboxMgr.outboxNode;
		}
	}
}
