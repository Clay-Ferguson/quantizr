package quanta.mail;

import java.util.Properties;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import jakarta.mail.BodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import quanta.config.ServiceBase;
import quanta.util.LimitedInputStream;

/**
 * Component that sends emails
 */
@Component
public class EmailSender extends ServiceBase { /* implements TransportListener */
    private static Logger log = LoggerFactory.getLogger(EmailSender.class);

    public static final Object lock = new Object();
    public static final String MIME_HTML = "text/html";
    public int TIMEOUT = 10000; // ten seconds
    public int TIMESLICE = 250; // quarter second
    public boolean debug = true;
    private JavaMailSenderImpl mailSender = null;

    public boolean mailEnabled() {
        return !StringUtils.isEmpty(prop.getMailPassword());
    }

    public static Object getLock() {
        return lock;
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
}

