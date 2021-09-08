package org.subnode.mail;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.config.SessionContext;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.NotificationMessage;
import org.subnode.service.PushService;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

/**
 * Manages the node where we store all emails that are queued up to be sent.
 * <p>
 * The system always sends emails out in a batch operation every 30seconds or so, by emptying out
 * this queue.
 * 
 */
@Component
public class OutboxMgr {

	private static final Logger log = LoggerFactory.getLogger(OutboxMgr.class);

	@Autowired
	private MongoCreate create;

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoUpdate update;

	@Autowired
	private AdminRun arun;

	@Autowired
	private AppProp appProp;

	private String mailBatchSize = "10";

	@Autowired
	private SubNodeUtil snUtil;

	@Autowired
	private PushService pushService;

	@Autowired
	private NotificationDaemon notificationDaemon;

	private static SubNode outboxNode = null;
	private static final Object outboxLock = new Object();

	/**
	 * Adds a node into the user's "Inbox" as an indicator to them that the 'node' added needs their
	 * attention, for some reason or that someone has shared this node with them.
	 * 
	 * @param session
	 * @param recieverUserName
	 * @param userNode
	 * @param node
	 * @param notifyMessage
	 */
	public void addInboxNotification(String recieverUserName, SubNode userNode, SubNode node, String notifyMessage) {

		arun.run(session -> {
			SubNode userInbox =
					read.getUserNodeByType(session, null, userNode, "### Inbox", NodeType.INBOX.s(), null, NodeName.INBOX);

			if (userInbox != null) {
				// log.debug("userInbox id=" + userInbox.getId().toHexString());

				/*
				 * First look to see if there is a target node already existing in this persons inbox that points to
				 * the node in question
				 */
				SubNode notifyNode =
						read.findSubNodeByProp(session, userInbox.getPath(), NodeProp.TARGET_ID.s(), node.getId().toHexString());

				/*
				 * If there's no notification for this node already in the user's inbox then add one
				 */
				if (notifyNode == null) {
					notifyNode = create.createNode(session, userInbox, null, NodeType.INBOX_ENTRY.s(), 0L,
							CreateNodeLocation.FIRST, null, null, true);

					// trim to 280 like twitter.
					String shortContent = XString.trimToMaxLen(node.getContent(), 280) + "...";
					String content =
							String.format("#### New from: %s\n%s", ThreadLocals.getSC().getUserName(), shortContent);

					notifyNode.setOwner(userInbox.getOwner());
					notifyNode.setContent(content);
					notifyNode.touch();
					notifyNode.setProp(NodeProp.TARGET_ID.s(), node.getId().toHexString());
					update.save(session, notifyNode);
				}

				/*
				 * Send push notification so the user sees live there's a new share comming in or being re-added
				 * even.
				 */
				List<SessionContext> scList = SessionContext.getSessionsByUserName(recieverUserName);
				if (scList != null) {
					for (SessionContext sc : scList) {
						pushService.sendServerPushInfo(sc,
								// todo-2: fill in the two null parameters here if/when you ever bring this method back.
								new NotificationMessage("newInboxNode", node.getId().toHexString(), "New node shared to you.",
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
	 * 
	 * @param ms
	 * @param fromUserName
	 * @param toUserNode
	 * @param node
	 */
	public void sendEmailNotification(MongoSession ms, String fromUserName, SubNode toUserNode, SubNode node) {
		String email = toUserNode.getStrProp(NodeProp.EMAIL.s());
		String toUserName = toUserNode.getStrProp(NodeProp.USER.s());
		// log.debug("sending node notification email to: " + email);

		String nodeUrl = snUtil.getFriendlyNodeUrl(ms, node);
		String content =
				String.format(appProp.getConfigText("brandingAppName") + " user '%s' shared a node to your '%s' account.<p>\n\n" + //
						"%s", fromUserName, toUserName, nodeUrl);

		queueMailUsingAdminSession(ms, email, "A " + appProp.getConfigText("brandingAppName") + " Node was shared to you!",
				content);
	}

	public void queueEmail(final String recipients, final String subject, final String content) {
		arun.run(session -> {
			queueMailUsingAdminSession(session, recipients, subject, content);
			return null;
		});
	}

	private void queueMailUsingAdminSession(MongoSession ms, final String recipients, final String subject,
			final String content) {

		SubNode outboxNode = getSystemOutbox(ms);
		SubNode outboundEmailNode = create.createNode(ms, outboxNode.getPath() + "/?", NodeType.NONE.s());

		outboundEmailNode.setOwner(ms.getUserNodeId());
		outboundEmailNode.setProp(NodeProp.EMAIL_CONTENT.s(), content);
		outboundEmailNode.setProp(NodeProp.EMAIL_SUBJECT.s(), subject);
		outboundEmailNode.setProp(NodeProp.EMAIL_RECIP.s(), recipients);

		update.save(ms, outboundEmailNode);

		notificationDaemon.setOutboxDirty();
	}

	/*
	 * Loads only up to mailBatchSize emails at a time
	 */
	public List<SubNode> getMailNodes(MongoSession ms) {
		SubNode outboxNode = getSystemOutbox(ms);
		// log.debug("outbox id: " + outboxNode.getId().toHexString());

		int mailBatchSizeInt = Integer.parseInt(mailBatchSize);
		return read.getChildrenAsList(ms, outboxNode, false, mailBatchSizeInt);
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

			snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT, NodeName.OUTBOX, null, "Outbox", null, true, null, null);

			OutboxMgr.outboxNode = snUtil.ensureNodeExists(ms, "/" + NodeName.ROOT, NodeName.OUTBOX + "/" + NodeName.SYSTEM,
					null, "System Messages", null, true, null, null);
			return OutboxMgr.outboxNode;
		}
	}
}
