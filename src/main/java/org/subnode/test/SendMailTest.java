package org.subnode.test;

import java.util.Date;

import org.subnode.mail.MailSender;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component("SendMailTest")
public class SendMailTest implements TestIntf {
    private static final Logger log = LoggerFactory.getLogger(SendMailTest.class);

    @Autowired
    private MailSender mailSender;

    @Override
    public void test() throws Exception {  
        try {
            mailSender.init();
            String timeString = new Date().toString();
            mailSender.sendMail("wclayf@gmail.com", null, "<h1>Hi Clay! Time="+timeString+"</h1>", "Test from SendMailTest.java");
        } finally {
            mailSender.close();
        }
    }
}
