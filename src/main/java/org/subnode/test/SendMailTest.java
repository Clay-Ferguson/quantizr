package org.subnode.test;

import java.util.Date;

import org.subnode.config.SpringContextUtil;
import org.subnode.mail.MailSender;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component("SendMailTest")
public class SendMailTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(SendMailTest.class);

    @Override
    public void test() throws Exception {
        MailSender mailSender = null;
        try {
            mailSender = (MailSender) SpringContextUtil.getBean(MailSender.class);
            mailSender.init();
            String timeString = new Date().toString();
            mailSender.sendMail("wclayf@gmail.com", null, "<h1>Hi Clay! Time=" + timeString + "</h1>",
                    "Test from SendMailTest.java");
        } finally {
            if (mailSender != null) {
                mailSender.close();
            }
        }
    }
}
