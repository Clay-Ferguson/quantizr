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

/**
 * This is the updated version of MailSender.java. It is updated to be slightly better and also
 * has verified compatibility with our new mail host "MailGun", so eventually the old MailSender.java
 * class will be deleted once MailGun is fully validated and online.
 * 
 * Implements and processes the sending of emails.
 */
@Component
public class MailSender implements TransportListener {

	private static final Logger log = LoggerFactory.getLogger(MailSender.class);

	@Autowired
	private AppProp appProp;

	public static final String MIME_HTML = "text/html";
	public int TIMEOUT = 10000; // ten seconds
	public int TIMESLICE = 250; // quarter second

	public boolean debug = true;
	public boolean success = false;
	public boolean waiting = false;

	private Properties props;
	private Session mailSession;
	private SMTPTransport transport;

	/*
	 * This method can and should be called before sending mails, close() method should be called
	 * after mail is sent
	 */
	public synchronized void init() {

		String mailHost = appProp.getMailHost();
		String mailUser = appProp.getMailUser();
		String mailPassword = appProp.getMailPassword();

		if (props == null) {
			props = new Properties();
			props.put("mail.smtps.host", mailHost);
        	props.put("mail.smtps.auth", "true");
		}

		/* close any existing mail transport */
		close();

		if (mailSession == null) {
			//NOTE: I had 'getDefaultInstance' here for many years, but the MailGun exampls used 'getInstance' so i switched.
			mailSession = Session.getInstance(props, null);
			mailSession.setDebug(debug);
		}

		try {
			transport = (SMTPTransport) mailSession.getTransport("smtps");
			transport.addTransportListener(this);
			transport.connect(mailHost, mailUser, mailPassword);
		}
		catch (Exception e) {
			throw ExUtil.newEx(e);
		}
	}

	public synchronized void close() {
		if (transport != null) {
			success = false;
			waiting = false;

			try {
				transport.close();
			}
			catch (Exception e) {
				throw ExUtil.newEx(e);
			}
			transport = null;
		}
	}

	private boolean isBusy() {
		return waiting;
	}

	public synchronized boolean sendMail(String sendToAddress, String fromAddress, String content, String subjectLine) {

		if (fromAddress==null) {
			fromAddress = appProp.getMailFrom();
		}

		if (transport == null) {
			throw ExUtil.newEx("Tried to use MailSender after close() call or without initializing.");
		}

		if (waiting) {
			throw ExUtil.newEx("concurrency must be done via 'isBusy' before each call");
		}

		MimeMessage message = new MimeMessage(mailSession);
		try {
			message.setSentDate(new Date());
			message.setSubject(subjectLine);
			message.setFrom(new InternetAddress(fromAddress));
			message.setRecipient(Message.RecipientType.TO, new InternetAddress(sendToAddress));
		}
		catch (Exception e) {
			throw ExUtil.newEx(e);
		}
		// MULTIPART
		// ---------------
		// MimeMultipart multipart = new MimeMultipart("part");
		// BodyPart messageBodyPart = new MimeBodyPart();
		// messageBodyPart.setContent(content, "text/html");
		// multipart.addBodyPart(messageBodyPart);
		// message.setContent(multipart);

		// SIMPLE (no multipart)
		// ---------------
		try {
			message.setContent(content, MIME_HTML);
		}
		catch (Exception e) {
			throw ExUtil.newEx(e);
		}

		// can get alreadyconnected exception here ??
		// transport.connect(mailHost, mailUser, mailPassword);

		success = false;

		/*
		 * important: while inside this 'sendMessage' method, the 'messageDelivered' callback will
		 * get called if the send is successful, so we can return the value below, even though we do
		 * not set it in this method
		 */
		int timeRemaining = TIMEOUT;
		waiting = true;
		try {
			transport.sendMessage(message, message.getRecipients(Message.RecipientType.TO));
			log.debug("Response: " + transport.getLastServerResponse()+" Code: "+transport.getLastReturnCode());

			while (waiting && timeRemaining > 0) {
				Thread.sleep(TIMESLICE);
				timeRemaining -= TIMESLICE;
			}
		}
		catch (Exception e) {
			throw ExUtil.newEx(e);
		}

		/* if we are still pending, that means a timeout so we give up */
		if (waiting) {
			waiting = false;
			log.debug("mail send failed.");
			throw ExUtil.newEx("mail system is not responding.  Email send failed.");
		}

		return success;
	}

	@Override
	public void messageDelivered(TransportEvent arg) {
		log.debug("messageDelivered.");
		success = true;
		waiting = false;
	}

	@Override
	public void messageNotDelivered(TransportEvent arg) {
		log.debug("messageNotDelivered.");
		success = false;
		waiting = false;
	}

	@Override
	public void messagePartiallyDelivered(TransportEvent arg) {
		log.debug("messagePartiallyDelivered.");
		success = false;
		waiting = false;
	}
}
