package quanta;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;

/*
 * NOTE: You can either use an ErrorController (which what we are doing) or else you can use the
 * actual hosting server's fallback error page by adding this annotation, but only do one or the
 * other.
 * 
 * @EnableAutoConfiguration(exclude = {ErrorMvcAutoConfiguration.class})
 * 
 * Standard SpringBoot entry point. Starts up entire application, which will run an instance of
 * Tomcat embedded and open the port specified in the properties file and start serving up requests.
 */
@EnableTransactionManagement
@SpringBootApplication
@EnableScheduling
@ServletComponentScan
public class AppServer extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AppServer.class);
    private static boolean shuttingDown;
    private static boolean enableScheduling;

    // Java Main entry point for the application
    public static void main(String[] args) {
        log.debug("AppServer.main()");
        /*
         * WARNING: looks like logging is not enabled yet at this point (can't log here) If we are running
         * AppServer then enableScheduling, otherwise we may be running some command line service such as
         * BackupUtil, in which case deamons need to be deactivated.
         */
        enableScheduling = true;
        SpringApplication.run(AppServer.class, args);
    }

    @EventListener
    public void handleContextClose(ContextClosedEvent event) {
        log.info("ContextClosedEvent");
    }

    public static void shutdownCheck() {
        if (shuttingDown)
            throw new RuntimeEx("Server is shutting down.");
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
