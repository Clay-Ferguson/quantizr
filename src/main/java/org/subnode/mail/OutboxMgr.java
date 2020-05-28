package org.subnode.mail;

import java.util.List;

import org.subnode.config.ConstantsProvider;
import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.XString;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Manages the node where we store all emails that are queued up to be sent.
 * <p>
 * The system always sends emails out in a batch operation every 30seconds or
 * so, by emptying out this queue.
 * 
 */
@Component
public class OutboxMgr {

	private static final Logger log = LoggerFactory.getLogger(OutboxMgr.class);

	@Autowired
	MongoApi api;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private ConstantsProvider constProvider;

	private String mailBatchSize = "10";

	@Autowired
	private SubNodeUtil apiUtil;

	/*
	 * node=Node that was created.
	 * 
	 * userName = username of person who just created node (also the owner of
	 * 'node')
	 */
	public void sendNotificationForNodeEdit(final SubNode node, final String userName) {
		boolean sendEmail = false;
		boolean addToInbox = true;

		/*
		 * put in a catch block, because nothing going wrong in here should be allowed
		 * to blow up the save operation
		 */
		adminRunner.run(session -> {
			try {
				SubNode parentNode = api.getParent(session, node);

				/*
				 * Check first that we are not creating a node under one WE OWN, becasue we
				 * don't need to send a notification to ourselves.
				 */
				if (parentNode != null && !parentNode.getOwner().equals(node.getOwner())) {

					/*
					 * userNode here will be the root node of the person whose node has just been
					 * replied to, and the person recieving a notification in their inbox
					 */
					SubNode userNode = api.getNode(session, parentNode.getOwner());
					if (userNode == null) {
						log.warn("No userNode was found for parentNode.owner=" + parentNode.getOwner());
						return;
					}

					if (sendEmail) {
						sendEmailNotification(session, userName, userNode, node);
					} else if (addToInbox) {
						addInboxNotification(session, userName, userNode, node, "replied to you.");
					}
				}
			} catch (Exception e) {
				log.debug("failed sending notification", e);
			}
		});
	}

	/**
	 * Puts an inbox notification into 'userNode's inbox, telling them that the new
	 * 'node' has been added under one of their nodes as a reply to it.
	 * 
	 * In these parameters 'userName' is the owner of 'node' that the notification
	 * is 'about'
	 * 
	 * Example sentence structure of notifyMessage:
	 * 
	 * <pre>
	 * 		"shared a node with you." 
	 * 		"replied to you."
	 * </pre>
	 */
	public void addInboxNotification(MongoSession session, String userName, SubNode userNode, SubNode node,
			String notifyMessage) {

		SubNode userInbox = api.getSpecialNode(session, null, userNode, NodeName.INBOX, "### Inbox", NodeType.INBOX.s());

		if (userInbox != null) {

			/*
			 * First look to see if there is a target node already existing in this persons
			 * inbox that points to the node in question
			 */
			SubNode notifyNode = api.findSubNodeByProp(session, userInbox.getPath(), NodeProp.TARGET_ID.s(),
					node.getId().toHexString());
			if (notifyNode != null) {
				// log.debug("target existed: " + node.getId().toHexString());
				return;
			}

			notifyNode = api.createNode(session, userInbox, null, NodeType.NONE.s(), 0L,
					CreateNodeLocation.FIRST);

			// trim to 280 like twitter.
			String shortContent = XString.trimToMaxLen(node.getContent(), 280) + "...";

			String content = String.format("#### **%s** " + notifyMessage + "\n\n%s?id=%s\n\n%s", userName,
					constProvider.getHostAndPort(), node.getId().toHexString(), shortContent);

			notifyNode.setOwner(userInbox.getOwner());
			notifyNode.setContent(content);
			notifyNode.setProp(NodeProp.TARGET_ID.s(), node.getId().toHexString());
			api.save(session, notifyNode);
		}
	}

	public void sendEmailNotification(MongoSession session, String userName, SubNode userNode, SubNode node) {
		String email = userNode.getStringProp(NodeProp.EMAIL.s());
		log.debug("sending email to: " + email + " because his node was appended under.");

		String content = String.format("User '%s' replied to you.<p>\n\n" + //
				"%s?id=%s", userName, constProvider.getHostAndPort(), node.getId().toHexString());

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
		SubNode outboundEmailNode = api.createNode(session, outboxNode.getPath() + "/?", NodeType.NONE.s());

		outboundEmailNode.setProp(NodeProp.EMAIL_CONTENT.s(), content);
		outboundEmailNode.setProp(NodeProp.EMAIL_SUBJECT.s(), subject);
		outboundEmailNode.setProp(NodeProp.EMAIL_RECIP.s(), recipients);

		api.save(session, outboundEmailNode);
	}

	/*
	 * Loads only up to mailBatchSize emails at a time
	 */
	public List<SubNode> getMailNodes(MongoSession session) {
		SubNode outboxNode = getSystemOutbox(session);

		int mailBatchSizeInt = Integer.parseInt(mailBatchSize);
		return api.getChildrenAsList(session, outboxNode, false, mailBatchSizeInt);
	}

	/*
	 * Get node that contains all preferences for this user, as properties on it.
	 */
	public SubNode getSystemOutbox(MongoSession session) {
		return apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT + "/" + NodeName.OUTBOX + "/", NodeName.SYSTEM,
				"System Messages", null, true, null, null);
	}
}
