package org.subnode.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.exception.base.RuntimeEx;

/**
 * Quantizr uses RuntimeExceptions primarily for all exception handling, throughout the app because
 * of the cleanness of the API when it doesn't have to declare checked exceptions everywhere, and
 * this utility encapsulates the conversion of most checked exceptions to RuntimeExceptions.
 * 
 * Note: This code doesn't ignore exceptions or alter our ability to properly handle ALL exceptions
 * of both types, but it just makes the code cleaner, by doing what the Java-language SHOULD have
 * done to begin with.
 */
public class ExUtil {
	private static final Logger log = LoggerFactory.getLogger(ExUtil.class);
	
	public static RuntimeEx newEx(Throwable ex) {

		if (ex instanceof RuntimeEx) {
			return (RuntimeEx) ex;
		}
		return new RuntimeEx(ex);
	}

	public static RuntimeEx newEx(String msg) {
		RuntimeEx ex = new RuntimeEx(msg);
		return ex;
	}

	public static void debug(Logger logger, String msg, Throwable e) {
		logger.debug(msg, e);

		/* Not showing all sub-causes in the chain, but just the immediate one */
		if (e.getCause() != null) {
			logger.debug("cause:", e);
		}
	}

	public static void error(Logger logger, String msg, Throwable e) {
		logger.error(msg, e);

		/* Not showing all sub-causes in the chain, but just the immediate one */
		if (e.getCause() != null) {
			logger.error("cause:", e);
		}
	}
}
