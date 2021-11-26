package org.subnode.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;

/**
 * DO NOT DELETE
 * 
 * For future reference only, I'm keeping this is as an example of how to call a SpringBoot app as a
 * command line app.
 */
// @SpringBootApplication
// @EnableScheduling
public class BackupUtil {
	private static final Logger log = LoggerFactory.getLogger(BackupUtil.class);

	public static void main(String[] args) {
		SpringApplication.run(BackupUtil.class, args);
		log.debug("App Started, and will shutdown now.");

		try {
			// command line app can run here.
		}
		catch (Exception e) {
			log.error("Backup failed.", e);
		}
		System.exit(0);
	}
}
