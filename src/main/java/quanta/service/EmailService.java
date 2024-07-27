package quanta.service;

import java.util.LinkedList;
import java.util.Properties;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import jakarta.mail.BodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import quanta.AppServer;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.LimitedInputStream;

/**
 * Deamon for sending emails.
 */
@Component 
public class EmailService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(EmailService.class);
    private int runCounter = 0;
    private static final int INTERVAL_SECONDS = 10;
    private int runCountdown = INTERVAL_SECONDS;
    private static boolean run = false;

    public static final Object lock = new Object();
    private JavaMailSenderImpl mailSender = null;

    private String mailBatchSize = "10";
    private static SubNode outboxNode = null;
    private static final Object outboxLock = new Object();
    private int emailService_runCount = 0;

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
    @Scheduled(fixedDelay = 30000)
    public void run() {
        emailService_runCount++;
        if (!initComplete || run || !MongoRepository.fullInit)
            return;

        // This first run will happen at startup and we don't want that.
        if (emailService_runCount == 1) {
            log.debug("emailService.run() first run, skipping.");
        }

        try {
            run = true;
            if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
                log.debug("ignoring NotificationDeamon schedule cycle");
                return;
            }
            runCounter++;
            // fail fast if no mail host is configured.
            if (StringUtils.isEmpty(prop.getMailHost())) {
                if (runCounter < 3) {
                    log.debug("NotificationDaemon is disabled, because no mail server is configured.");
                }
                return;
            }
            if (--runCountdown <= 0) {
                runCountdown = INTERVAL_SECONDS;
                arun.run(as -> {
                    LinkedList<SubNode> mailNodes = mongoUtil.asList(getMailNodes(as));
                    if (mailNodes.size() > 0) {
                        sendAllMail(as, mailNodes);
                    }
                    return null;
                });
            }
        } catch (Exception e) {
            log.error("notification deamo cycle fail", e);
        } finally {
            run = false;
        }
    }

    // Triggers the next cycle to not wait, but process immediately
    public void setOutboxDirty() {
        runCountdown = 0;
    }

    private void sendAllMail(MongoSession ms, Iterable<SubNode> nodes) {
        synchronized (getLock()) {
            for (SubNode node : nodes) {
                log.debug("Iterating node to email. nodeId:" + node.getIdStr());
                String email = node.getStr(NodeProp.EMAIL_RECIP);
                String subject = node.getStr(NodeProp.EMAIL_SUBJECT);
                String content = node.getStr(NodeProp.EMAIL_CONTENT);
                if (!StringUtils.isEmpty(email) && !StringUtils.isEmpty(subject) && !StringUtils.isEmpty(content)) {
                    log.debug("Found mail to send to: " + email);
                    if (delete.delete(ms, node, false) > 0) {
                        // only send mail if we were able to delete the node, because other wise something is wrong
                        // without ability to delete and so we'd go into a loop sending this item multiple times.
                        sendMail(email, null, content, subject);
                    } else {
                        log.debug("Unable to delete queued mail node: " + node.getIdStr());
                    }
                } else {
                    log.debug("not sending email. Missing some properties. email or subject or content");
                }
            }
        }
    }

    public boolean mailEnabled() {
        return !StringUtils.isEmpty(prop.getMailPassword());
    }

    public static Object getLock() {
        return lock;
    }

    public void sendDevEmail(String subject, String content) {
        synchronized (EmailService.getLock()) {
            String devEmail = prop.getDevEmail();
            String fromAddress = prop.getMailFrom();
            email.sendMail(devEmail, fromAddress, content, "Quanta: " + prop.getHostAndPort() + ": " + subject);
        }
    }

    public void sendMail(String sendToAddress, String fromAddress, String content, String subjectLine) {
        if (!mailEnabled())
            return;

        initJavaMailSender();
        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromAddress);
                message.setTo(sendToAddress);
                message.setSubject(subjectLine);
                message.setText(content);
                mailSender.send(message);
            } catch (Exception e) {
                log.error("Failed to send email", e);
            }
        }
    }

    public void initJavaMailSender() {
        if (mailSender != null || StringUtils.isEmpty(prop.getMailPassword()))
            return;

        String mailHost = prop.getMailHost();
        String mailUser = prop.getMailUser();
        String mailPassword = prop.getMailPassword();

        mailSender = new JavaMailSenderImpl();
        mailSender.setHost(mailHost);
        mailSender.setPort(587);
        mailSender.setUsername(mailUser);
        mailSender.setPassword(mailPassword);

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.debug", "true");
    }

    // Converts a stream of EML file text to Markdown
    public String convertEmailToMarkdown(LimitedInputStream is) {
        StringBuilder cont = new StringBuilder();
        try {
            MimeMessage message = new MimeMessage(null, is);
            cont.append("#### " + message.getSubject());
            cont.append("\n");
            cont.append("From: " + message.getFrom()[0]);
            cont.append("\n\n");
            Object obj = message.getContent();
            if (obj instanceof MimeMultipart mm) {
                for (int i = 0; i < mm.getCount(); i++) {
                    BodyPart part = mm.getBodyPart(i);
                    if (part.getContentType().startsWith("text/plain;")) {
                        cont.append(part.getContent().toString());
                        cont.append("\n\n");
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to upload", e);
        }
        return cont.toString();
    }

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
        if (outboxNode != null) {
            return outboxNode;
        }
        synchronized (outboxLock) {
            // yep it's correct threading to check the node value again once inside the lock
            if (outboxNode != null) {
                return outboxNode;
            }
            snUtil.ensureNodeExists(ms, NodePath.ROOT_PATH, NodePath.OUTBOX, "Outbox", null, true, null, null);
            outboxNode = snUtil.ensureNodeExists(ms, NodePath.ROOT_PATH, NodePath.OUTBOX + "/" + NodePath.SYSTEM,
                    "System Messages", null, true, null, null);
            return outboxNode;
        }
    }
}
