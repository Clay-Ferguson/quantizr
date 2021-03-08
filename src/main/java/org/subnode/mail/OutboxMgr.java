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
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.NotificationMessage;
import org.subnode.service.UserFeedService;
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
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private AppProp appProp;

	private String mailBatchSize = "10";

	@Autowired
	private SubNodeUtil apiUtil;

	@Autowired
	private UserFeedService userFeedService;

	/* Currently unused. Let's leave this capability here and not delete this code, but it's no longer being used. */
	public void addInboxNotification(MongoSession session, String recieverUserName, SubNode userNode, SubNode node,
			String notifyMessage) {

		SubNode userInbox = read.getUserNodeByType(session, null, userNode, "### Inbox", NodeType.INBOX.s(), null);

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
				notifyNode = create.createNode(session, userInbox, null, NodeType.INBOX_ENTRY.s(), 0L, CreateNodeLocation.FIRST,
						null, null, true);

				// trim to 280 like twitter.
				String shortContent = XString.trimToMaxLen(node.getContent(), 280) + "...";

				String content = String.format("#### **%s** " + notifyMessage + "\n\n%s/app?id=%s\n\n%s",
						ThreadLocals.getSessionContext().getUserName(), appProp.getHostAndPort(), node.getId().toHexString(),
						shortContent);

				notifyNode.setOwner(userInbox.getOwner());
				notifyNode.setContent(content);
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
					userFeedService.sendServerPushInfo(sc,
							// todo-2: fill in the two null parameters here if/when you ever bring this method back.
							new NotificationMessage("newInboxNode", node.getId().toHexString(), null, null));
				}
			}
		}
	}

	public void sendEmailNotification(MongoSession session, String userName, SubNode userNode, SubNode node) {
		String email = userNode.getStrProp(NodeProp.EMAIL.s());
		log.debug("sending email to: " + email + " because his node was appended under.");

		String content = String.format("User '%s' replied to you.<p>\n\n" + //
				"%s/app?id=%s", userName, appProp.getHostAndPort(), node.getId().toHexString());

		queueMailUsingAdminSession(session, email, "New SubNode Notification", content);
	}

	public void queueEmail(final String recipients, final String subject, final String content) {
		adminRunner.run(session -> {
			queueMailUsingAdminSession(session, recipients, subject, content);
		});
	}

	public void queueMailUsingAdminSession(MongoSession session, final String recipients, final String subject,
			final String content) {
		SubNode outboxNode = getSystemOutbox(session);
		SubNode outboundEmailNode = create.createNode(session, outboxNode.getPath() + "/?", NodeType.NONE.s());

		outboundEmailNode.setProp(NodeProp.EMAIL_CONTENT.s(), content);
		outboundEmailNode.setProp(NodeProp.EMAIL_SUBJECT.s(), subject);
		outboundEmailNode.setProp(NodeProp.EMAIL_RECIP.s(), recipients);

		update.save(session, outboundEmailNode);
	}

	/*
	 * Loads only up to mailBatchSize emails at a time
	 */
	public List<SubNode> getMailNodes(MongoSession session) {
		SubNode outboxNode = getSystemOutbox(session);

		int mailBatchSizeInt = Integer.parseInt(mailBatchSize);
		return read.getChildrenAsList(session, outboxNode, false, mailBatchSizeInt);
	}

	/*
	 * Get node that contains all preferences for this user, as properties on it.
	 */
	public SubNode getSystemOutbox(MongoSession session) {
		return apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT + "/outbox/", NodeName.SYSTEM, null, "System Messages", null,
				true, null, null);
	}
}
