package org.subnode.mail;

import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.subnode.AppServer;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.model.SubNode;

/**
 * Deamon for sending emails periodically.
 * 
 * We need this daemon so that we can do email sending without blocking any of the requests that
 * require emails to be sent. That is, when some service method requires an email to be sent it
 * doesn't send the request or even spawn a thread to send the request. It simply queues up in
 * persistent storage he emails ready to be send and sends them out all in a single mail session all
 * at once. This is the most efficient way for lots of obvious reasons.
 */
@Component
public class NotificationDaemon {

	private static final Logger log = LoggerFactory.getLogger(NotificationDaemon.class);

	@Autowired
	private MongoDelete delete;

	@Autowired
	private AppProp appProp;

	@Autowired
	private AdminRun arun;

	@Autowired
	private OutboxMgr outboxMgr;

	@Autowired
	private MailSender mailSender;

	private int runCounter = 0;

	public static final int INTERVAL_SECONDS = 10;
	private int runCountdown = INTERVAL_SECONDS;

	static Object runLock = new Object();

	/*
	 * Note: Spring does correctly protect against concurrent runs. It will always wait until the last
	 * run of this function is completed before running again. So we can always assume only one
	 * thread/deamon of this class is running at at time, because this is a singleton class.
	 * 
	 * see also: @EnableScheduling (in this project)
	 * 
	 * @Scheduled value is in milliseconds.
	 * 
	 * Runs immediately at startup, and then every 10 seconds
	 */
	@Scheduled(fixedDelay = 1000)
	public void run() {
		synchronized (runLock) {
			try {
				if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
					log.debug("ignoring NotificationDeamon schedule cycle");
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

				if (--runCountdown <= 0) {
					runCountdown = INTERVAL_SECONDS;

					arun.run((MongoSession ms) -> {
						List<SubNode> mailNodes = outboxMgr.getMailNodes(ms);
						if (mailNodes != null) {
							log.debug("Found " + String.valueOf(mailNodes.size()) + " mailNodes to send.");
							sendAllMail(ms, mailNodes);
						} 
						return null;
					});
				}
			} catch (Exception e) {
				log.error("notification deamo cycle fail", e);
			}
		}
	}

	/* Triggers the next cycle to not wait, but process immediately */
	public void setOutboxDirty() {
		runCountdown = 0;
	}

	private void sendAllMail(MongoSession ms, List<SubNode> nodes) {
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

						String email = node.getStrProp(NodeProp.EMAIL_RECIP.s());
						String subject = node.getStrProp(NodeProp.EMAIL_SUBJECT.s());
						String content = node.getStrProp(NodeProp.EMAIL_CONTENT.s());

						if (!StringUtils.isEmpty(email) && !StringUtils.isEmpty(subject) && !StringUtils.isEmpty(content)) {

							log.debug("Found mail to send to: " + email);
							if (delete.delete(ms, node, false) > 0) {
								// only send mail if we were able to delete the node, because other wise something is wrong
								// without ability to delete and so we'd go into a loop sending this item multiple times.
								mailSender.sendMail(email, null, content, subject);
							} else {
								log.debug("Unable to delete queued mail node: " + node.getId().toHexString());
							}
						} else {
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
