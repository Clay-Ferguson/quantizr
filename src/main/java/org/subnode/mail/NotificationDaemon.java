package org.subnode.mail;

import java.util.List;

import org.subnode.AppServer;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

/**
 * Deamon for sending emails periodically.
 * 
 * We need this daemon so that we can do email sending without blocking any of
 * the requests that require emails to be sent. That is, when some service
 * method requires an email to be sent it doesn't send the request or even spawn
 * a thread to send the request. It simply queues up in persistent storage he
 * emails ready to be send and sends them out all in a single mail session all
 * at once. This is the most efficient way for lots of obvious reasons.
 * 
 */
@Component
public class NotificationDaemon {

	private static final Logger log = LoggerFactory.getLogger(NotificationDaemon.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private MailSender mailSender;

	private int runCounter = 0;

	/*
	 * Note: Spring does correctly protect against concurrent runs. It will always
	 * wait until the last run of this function is completed before running again.
	 * So we can always assume only one thread/deamon of this class is running at at
	 * time, because this is a singleton class.
	 * 
	 * see also: @EnableScheduling (in this project)
	 * 
	 * @Scheduled value is in milliseconds.
	 */
	@Scheduled(fixedDelay = 30 * 1000)
	public void run() {
		if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
			log.debug("ignoring schedule cycle");
			return;
		}

		runCounter++;

		/* fail fast if no mail host is configured. */
		if (StringUtils.isEmpty(appProp.getMailHost())) {
			if (runCounter < 3) {
				log.debug("NotificationDaemon is disabled, because no mail server is configured.");
			}
			return;
		}

		adminRunner.run((MongoSession session) -> {
			List<SubNode> mailNodes = outboxMgr.getMailNodes(session);
			if (mailNodes != null) {
				log.debug("Found " + String.valueOf(mailNodes.size()) + " mailNodes to send.");
				sendAllMail(session, mailNodes);
			}
		});
	}

	private void sendAllMail(MongoSession session, List<SubNode> nodes) {
		synchronized (MailSender.getLock()) {
			log.debug("MailSender lock obtained.");

			if (CollectionUtils.isEmpty(nodes)) {
				return;
			}

			synchronized (MailSender.getLock()) {
				try {
					mailSender.init();
					for (SubNode node : nodes) {
						log.debug("Iterating node to email. nodeId:" + node.getId().toHexString());

						String email = node.getStringProp(NodeProp.EMAIL_RECIP.s());
						String subject = node.getStringProp(NodeProp.EMAIL_SUBJECT.s());
						String content = node.getStringProp(NodeProp.EMAIL_CONTENT.s());

						if (!StringUtils.isEmpty(email) && !StringUtils.isEmpty(subject)
								&& !StringUtils.isEmpty(content)) {

							log.debug("Found mail to send to: " + email);
							mailSender.sendMail(email, null, content, subject);
							api.delete(session, node);
						}
						else {
							log.debug("not sending email. Missing some properties. email or subject or content");
						}
					}
				} finally {
					mailSender.close();
				}
			}
		}
	}
}
