package org.subnode;

import org.subnode.config.ConstantsProvider;
import org.subnode.model.client.PrincipalName;
import org.subnode.util.ExUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Standard SpringBoot entry point. Starts up entire application, which will run
 * an instance of Tomcat embedded and open the port specified in the properties
 * file and start serving up requests.
 */
@SpringBootApplication
@EnableScheduling
@ServletComponentScan
public class AppServer {
	private static final Logger log = LoggerFactory.getLogger(AppServer.class);

	@Autowired
	private ConstantsProvider constProvider;

	private static boolean shuttingDown;
	private static boolean enableScheduling;

	/* Java Main entry point for Quantizr application */

	public static void main(String[] args) {
		/*
		 * If we are running AppServer then enableScheduling, otherwise we may be
		 * running some command line service such as BackupUtil, in which case deamons
		 * need to be deactivated.
		 */
		enableScheduling = true;
		SpringApplication.run(AppServer.class, args);

		// Note: See SpringContextUtil.java for more code that runs at startup time.
	}

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		log.info("ContextRefreshedEvent.");
		log.debug("PROFILE: " + constProvider.getProfileName());
	}

	@EventListener
	public void handleContextRefresh(ContextClosedEvent event) {
		log.info("ContextClosedEvent");
	}

	public static void shutdownCheck() {
		if (shuttingDown)
			throw ExUtil.newEx("Server is shutting down.");
	}

	public static boolean isShuttingDown() {
		return shuttingDown;
	}

	public static void setShuttingDown(boolean shuttingDown) {
		AppServer.shuttingDown = shuttingDown;
	}

	public static boolean isEnableScheduling() {
		return enableScheduling;
	}
}
