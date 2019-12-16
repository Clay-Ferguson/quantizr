package org.subnode.mail;

import java.util.List;

import org.subnode.config.ConstantsProvider;
import org.subnode.config.NodeName;
import org.subnode.config.NodeProp;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.mongo.model.SubNodeTypes;
import org.subnode.util.SubNodeUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Manages the node where we store all emails that are queued up to be sent.
 * <p>
 * The system always sends emails out in a batch operation every 30seconds or so, by emptying out
 * this queue.
 * 
 */
@Component
public class JcrOutboxMgr {

	private static final Logger log = LoggerFactory.getLogger(JcrOutboxMgr.class);

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
	 * node=Node that was created. userName = username of person who just created node.
	 */
	public void sendNotificationForChildNodeCreate(final SubNode node, final String userName) {
		/*
		 * put in a catch block, because nothing going wrong in here should be allowed to blow up
		 * the save operation
		 */
		adminRunner.run(session -> {
			try {
				SubNode parentNode = api.getParent(session, node);

				/*
				 * Check first that we are not creating a node under one WE OWN, becasue we don't
				 * need to send a notification to ourselves.
				 */
				if (parentNode != null && !parentNode.getOwner().equals(node.getOwner())) {
					SubNode userNode = api.getNode(session, parentNode.getOwner());
					String email = userNode.getStringProp(NodeProp.EMAIL);
					log.debug("sending email to: " + email + " because his node was appended under.");

					String content = String.format("User '%s' replied to you.<p>\n\n" + //
					"%s?id=%s", userName, constProvider.getHostAndPort(), node.getId().toHexString());

					queueMailUsingAdminSession(session, email, "New SubNode Notification", content);
				}
			}
			catch (Exception e) {
				log.debug("failed sending notification", e);
			}
		});
	}

	public void queueEmail(final String recipients, final String subject, final String content) {
		adminRunner.run(session -> {
			queueMailUsingAdminSession(session, recipients, subject, content);
		});
	}

	public void queueMailUsingAdminSession(MongoSession session, final String recipients, final String subject, final String content) {
		SubNode outboxNode = getSystemOutbox(session);
		SubNode outboundEmailNode = api.createNode(session, outboxNode.getPath() + "/?", SubNodeTypes.UNSTRUCTURED);

		outboundEmailNode.setProp(NodeProp.EMAIL_CONTENT, content);
		outboundEmailNode.setProp(NodeProp.EMAIL_SUBJECT, subject);
		outboundEmailNode.setProp(NodeProp.EMAIL_RECIP, recipients);

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
		return apiUtil.ensureNodeExists(session, "/" + NodeName.ROOT + "/" + NodeName.OUTBOX + "/", NodeName.SYSTEM, "System Messages", null,true, null, null);
	}
}
