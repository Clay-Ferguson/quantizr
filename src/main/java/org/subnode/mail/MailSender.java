package org.subnode.mail;

import java.util.Date;
import java.util.Properties;

import javax.mail.Message;
import javax.mail.Session;
import javax.mail.event.TransportEvent;
import javax.mail.event.TransportListener;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

import org.subnode.config.AppProp;
import org.subnode.util.ExUtil;
import com.sun.mail.smtp.SMTPTransport;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

//Example call pattern:
// synchronized (MailSender.getLock()) {
// 	try {
// 		mailSender.init();
// 		mailSender.sendMail("wclayf@gmail.com", null,
// 				"<h1>Hello from Quantizr! Time=" + timeString + "</h1>", "Test Subject");
//      call sendMail as may times as necessary before close();
// 	} finally {
// 		mailSender.close();
// 	}
// }

@Component
public class MailSender implements TransportListener {

	private static final Logger log = LoggerFactory.getLogger(MailSender.class);

	@Autowired
	private AppProp appProp;

	public static final Object lock = new Object();

	public static final String MIME_HTML = "text/html";
	public int TIMEOUT = 10000; // ten seconds
	public int TIMESLICE = 250; // quarter second

	public boolean debug = true;
	private Properties props;
	private Session mailSession;
	private SMTPTransport transport;

	/*
	 * This method can and should be called before sending mails, close() method
	 * should be called after mail is sent
	 */
	public void init() {
		log.trace("MailSender.init()");

		String mailHost = appProp.getMailHost();
		String mailUser = appProp.getMailUser();
		String mailPassword = appProp.getMailPassword();

		if (mailSession == null) {
			props = new Properties();
			props.put("mail.smtps.host", mailHost);
			props.put("mail.smtps.auth", "true");

			mailSession = Session.getInstance(props, null);
			if (mailSession != null) {
				log.trace("Created mailSession");
			}
			mailSession.setDebug(debug);
		}

		try {
			transport = (SMTPTransport) mailSession.getTransport("smtps");
			if (transport != null) {
				log.trace("Created mail transport.");
			}

			transport.addTransportListener(this);

			log.trace("Connecting to mailHost " + mailHost);
			transport.connect(mailHost, mailUser, mailPassword);
			log.trace("connected");

		} catch (Exception e) {
			throw ExUtil.newEx(e);
		}
	}

	public static Object getLock() {
		return lock;
	}

	public void close() {
		if (transport != null) {
			try {
				transport.close();
			} catch (Exception e) {
				throw ExUtil.newEx(e);
			} finally {
				transport = null;
			}
		}
	}

	public void sendMail(String sendToAddress, String fromAddress, String content, String subjectLine) {
		if (fromAddress == null) {
			fromAddress = appProp.getMailFrom();
		}

		if (transport == null) {
			throw ExUtil.newEx("Tried to use MailSender after close() call or without initializing.");
		}

		MimeMessage message = new MimeMessage(mailSession);
		try {
			message.setSentDate(new Date());
			message.setSubject(subjectLine);
			message.setFrom(new InternetAddress(fromAddress));
			message.setRecipient(Message.RecipientType.TO, new InternetAddress(sendToAddress));

			// MULTIPART
			// ---------------
			// MimeMultipart multipart = new MimeMultipart("part");
			// BodyPart messageBodyPart = new MimeBodyPart();
			// messageBodyPart.setContent(content, "text/html");
			// multipart.addBodyPart(messageBodyPart);
			// message.setContent(multipart);

			// SIMPLE (no multipart)
			// ---------------
			message.setContent(content, MIME_HTML);

			// can get alreadyconnected exception here ??
			// transport.connect(mailHost, mailUser, mailPassword);

			/*
			 * important: while inside this 'sendMessage' method, the 'messageDelivered'
			 * callback will get called if the send is successful, so we can return the
			 * value below, even though we do not set it in this method
			 */

			transport.sendMessage(message, message.getRecipients(Message.RecipientType.TO));

			// I'm not sure if the callbacks are on this same thread or not. Commenting out
			// pending research into this.
			// log.debug("Response: " + transport.getLastServerResponse() + " Code: " +
			// transport.getLastReturnCode());
		} catch (Exception e) {
			throw ExUtil.newEx(e);
		}
	}

	@Override
	public void messageDelivered(TransportEvent arg) {
		log.trace("messageDelivered.");
	}

	@Override
	public void messageNotDelivered(TransportEvent arg) {
		log.trace("messageNotDelivered.");
	}

	@Override
	public void messagePartiallyDelivered(TransportEvent arg) {
		log.trace("messagePartiallyDelivered.");
	}
}
