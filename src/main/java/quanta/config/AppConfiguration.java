package quanta.config;

import org.apache.catalina.Context;
import org.apache.catalina.connector.Connector;
import org.apache.tomcat.util.descriptor.web.SecurityCollection;
import org.apache.tomcat.util.descriptor.web.SecurityConstraint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.spring6.view.ThymeleafViewResolver;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import quanta.service.AppController;
import quanta.service.AppFilter;
import quanta.service.UtilFilter;

// @EnableAspectJAutoProxy // (proxyTargetClass = true)
/**
 * Standard Spring WebMvcConfigurerAdapter-derived class.
 */
@Configuration
@EnableAsync
public class AppConfiguration implements WebMvcConfigurer {
    private static Logger log = LoggerFactory.getLogger(AppConfiguration.class);

    @Autowired
    private AppProp appProp;

    @Autowired
    private AppFilter appFilter;

    // // DO NOT DELETE (this is diagnostic code)
    // @Autowired
    // private DataTransferRateFilter dataTransferRateFilter;

    @Autowired
    private UtilFilter utilFilter;

    private static Object execInitLock = new Object();
    private static ThreadPoolTaskExecutor executor;

    @Bean
    public FilterRegistrationBean<AppFilter> appFilterRegistration() {
        FilterRegistrationBean<AppFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(appFilter);
        reg.setOrder(3);
        reg.addUrlPatterns("/");
        reg.addUrlPatterns("/u/*");
        reg.addUrlPatterns("/n/*");
        reg.addUrlPatterns(AppController.ADMIN_PATH + "/*");
        reg.addUrlPatterns(AppController.API_PATH + "/*");
        reg.addUrlPatterns(AppController.FILE_PATH + "/*");
        reg.addUrlPatterns("/stripe/*");
        return reg;
    }

    // DO NOT DELETE (this is diagnostic code)
    // @Bean
    // public FilterRegistrationBean<DataTransferRateFilter> filterRegistrationBean() {
    // FilterRegistrationBean<DataTransferRateFilter> reg = new FilterRegistrationBean<>();
    // reg.setFilter(dataTransferRateFilter);
    // reg.setOrder(1);
    // reg.addUrlPatterns("/images/*");
    // reg.addUrlPatterns("/fonts/*");
    // reg.addUrlPatterns("/dist/*");
    // reg.addUrlPatterns(AppController.API_PATH + "/bin/*");
    // return reg;
    // }

    @Bean
    public FilterRegistrationBean<UtilFilter> utilFilterRegistration() {
        FilterRegistrationBean<UtilFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(utilFilter);
        reg.setOrder(2);
        reg.addUrlPatterns("/images/*");
        reg.addUrlPatterns("/fonts/*");
        reg.addUrlPatterns("/dist/*");
        reg.addUrlPatterns(AppController.API_PATH + "/getOpenGraph");
        return reg;
    }

    // To avoid error message during startup
    // "No qualifying bean of type 'org.springframework.scheduling.TaskScheduler' available" we have to
    // provide spring with a Task Scheduler.
    @Bean
    public TaskScheduler taskScheduler() {
        return new ConcurrentTaskScheduler(); // single threaded by default
    }

    // This method is not perfectly thread-safe but Spring initializes this during context
    // initialization only so it's ok
    @Bean(name = "threadPoolTaskExecutor")
    public ThreadPoolTaskExecutor threadPoolTaskExecutor() {
        if (executor != null) {
            return executor;
        }
        synchronized (execInitLock) {
            ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();

            // note: Unless proven otherwise, default this to the number of CPU cores.
            exec.setCorePoolSize(4);

            // t.setAwaitTerminationSeconds(20);
            // t.setAllowCoreThreadTimeOut(true);
            // t.setKeepAliveSeconds(120);
            // only set the instance variable once the object is fully ready.
            executor = exec;
            log.debug("Created threadPoolTaskExecutor: hashCode=" + exec.hashCode());
            return exec;
        }
    }

    public static void shutdown() {
        if (executor != null) {
            log.debug("Shutting down global executor: executor.hashCode=" + executor.hashCode() + " class="
                    + executor.getClass().getName());
            executor.shutdown();
        }
    }

    // DO NOT DELETE (keep for future reference)
    //
    // This method is removed because we switched to using the spring.resources.static-locations
    // property in application.properties file to accomplish loading static files
    //
    // import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistration;
    // import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
    // import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
    // import org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter;
    // @Override
    // public void addResourceHandlers(ResourceHandlerRegistry registry) {
    // /*
    // This is how we enable the JS files to be edited and tested without doing a rebuild and restart
    // of
    // server code. We can just run TSC compile to generate the new JS files (or let vite do that),
    // and then refresh the browser to reload them. This jsBaseFolder should of course be empty
    // (unused)
    // in production environment, or any time the JAR (build) should be used exclusively at runtime,
    // rather than serving from actual directories at runtime
    //
    // NOTE: There is another way to do this also:
    // https://stackoverflow.com/questions/21123437/how-do-i-use-spring-boot-to-serve-static-content-
    // located-in-dropbox-folder
    ///
    // if (!StringUtils.isEmpty(appProp.getResourcesBaseFolder())) {
    // ResourceHandlerRegistration reg = registry.addResourceHandler("/**");
    // List<String> folders = XString.tokenize(appProp.getResourcesBaseFolder(), ",", true);
    // if (ok(folders )) {
    // for (String folder : folders) {
    // File dir = new File(folder);
    // if (dir.isDirectory()) {
    // log.error("Resource Dir not found: " + folder);
    // } else {
    // log.debug("Resource Dir found ok:" + folder);
    // }
    // reg.addResourceLocations(folder);
    // }
    // }
    // }
    // }

    @Bean
    public ServletWebServerFactory servletContainer(GracefulShutdown gracefulShutdown) {
        TomcatServletWebServerFactory factory = null;
        if ("https".equalsIgnoreCase(appProp.getHttpProtocol())) {
            // This function is part of what's required to enable SSL on port 80.
            factory = new TomcatServletWebServerFactory() {
                @Override
                protected void postProcessContext(Context context) {
                    SecurityConstraint securityConstraint = new SecurityConstraint();
                    securityConstraint.setUserConstraint("CONFIDENTIAL");
                    SecurityCollection collection = new SecurityCollection();
                    collection.addPattern("/*");
                    securityConstraint.addCollection(collection);
                    context.addConstraint(securityConstraint);
                }
            };
            factory.addAdditionalTomcatConnectors(redirectConnector());
        } else {
            factory = new TomcatServletWebServerFactory();
        }
        factory.addConnectorCustomizers(gracefulShutdown);
        log.debug("GracefulShutdown configured.");
        return factory;
    }

    private Connector redirectConnector() {
        Connector connector = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
        connector.setScheme("http");
        connector.setPort(80);
        connector.setSecure(false);
        connector.setRedirectPort(443);
        return connector;
    }

    @Bean
    @Scope("singleton")
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public ClassLoaderTemplateResolver templateResolver() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("public/dist/");
        templateResolver.setCacheable(!appProp.isDevEnv());
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        return templateResolver;
    }

    @Bean
    public SpringTemplateEngine templateEngine() {
        SpringTemplateEngine templateEngine = new SpringTemplateEngine();
        templateEngine.setTemplateResolver(templateResolver());
        return templateEngine;
    }

    @Bean
    public ViewResolver viewResolver() {
        ThymeleafViewResolver viewResolver = new ThymeleafViewResolver();
        viewResolver.setTemplateEngine(templateEngine());
        viewResolver.setCharacterEncoding("UTF-8");
        return viewResolver;
    }
}
