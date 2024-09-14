package quanta.util;

import org.slf4j.Logger;
import quanta.exception.base.RuntimeEx;

/**
 * We use RuntimeExceptions primarily for all exception handling, throughout the app because of the
 * cleanness of the API when it doesn't have to declare checked exceptions everywhere, and this
 * utility encapsulates the conversion of most checked exceptions to RuntimeExceptions.
 *
 * Note: This code doesn't ignore exceptions or alter our ability to properly handle ALL exceptions
 * of both types, but it just makes the code cleaner, by doing what the Java-language SHOULD have
 * done to begin with. 
 */
public class ExUtil {

    // Note: We can's use ExceptionUtils.getStackTrace(e), because we support thread
    // argument here
    public static final String getStackTrace(Thread thread) {
        if (thread == null) {
            thread = Thread.currentThread();
        }
        StringBuilder sb = new StringBuilder();
        StackTraceElement[] trace = thread.getStackTrace();

        for (int i = 0; i < trace.length; i++) {
            StackTraceElement e = trace[i];
            sb.append("    ");
            sb.append(e.toString());
            sb.append("\n");
        }
        return (sb.toString());
    }

    private static boolean checkLogged(Throwable e) {
        if (e instanceof RuntimeEx _e) {
            if (_e.logged) {
                return true;
            }
            _e.logged = true;
        }
        return false;
    }

    public static void debug(Logger logger, String msg, Throwable e) {
        if (checkLogged(e)) return;
        logger.debug(msg, e);
        // Not showing all sub-causes in the chain, but just the immediate one
        if (e.getCause() != null) {
            if (checkLogged(e.getCause())) return;
            logger.debug("cause:", e.getCause());
        }
    }

    public static void error(Logger logger, Throwable e) {
        error(logger, null, e);
    }

    public static void error(Logger logger, String msg, Throwable e) {
       if (checkLogged(e)) return;

        logger.error(msg == null ? e.getMessage() : msg, e);
        // Not showing all sub-causes in the chain, but just the immediate one
        if (e.getCause() != null) {
            if (checkLogged(e.getCause())) return;
            logger.error("cause:", e.getCause());
        }
    }

    public static void warn(Logger logger, String msg, Throwable e) {
        logger.warn(msg, e);
        // Not showing all sub-causes in the chain, but just the immediate one
        if (e.getCause() != null) {
            if (checkLogged(e.getCause())) return;
            logger.warn("cause:", e.getCause());
        }
    }
}
