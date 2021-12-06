package org.subnode.config;

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
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.subnode.AppController;
import org.subnode.filter.AppFilter;
import org.thymeleaf.spring5.SpringTemplateEngine;
import org.thymeleaf.spring5.view.ThymeleafViewResolver;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import static org.subnode.util.Util.*;

/**
 * Standard Spring WebMvcConfigurerAdapter-derived class.
 * 
 * There's a lot of commented code in here, but most of it I'm keeping just for future reference,
 * because there's always numerous different ways to do things, and I want to keep all that stuff as
 * FYI, and to remind the other ways of doing things.
 */
@Configuration
@EnableAsync
public class AppConfiguration implements WebMvcConfigurer {
	private static final Logger log = LoggerFactory.getLogger(AppConfiguration.class);

	@Autowired
	private AppProp appProp;

	@Autowired
	private AppFilter appFilter;

	private static ThreadPoolTaskExecutor executor;

	/* NOTE: The AppFilter is the only one of our filters that we limit the path for */
	@Bean
	public FilterRegistrationBean<AppFilter> appFilterRegistration() {
		FilterRegistrationBean<AppFilter> registration = new FilterRegistrationBean<>();
		registration.setFilter(appFilter);
		registration.addUrlPatterns(AppController.API_PATH + "/*");
		return registration;
	}

	/*
	 * To avoid error message during startup
	 * "No qualifying bean of type 'org.springframework.scheduling.TaskScheduler' available" we have to
	 * provide spring with a Task Scheduler.
	 */
	@Bean
	public TaskScheduler taskScheduler() {
		return new ConcurrentTaskScheduler(); // single threaded by default
	}

	/*
	 * This method is not perfectly thread-safe but Spring initializes this during context
	 * initialization only so it's ok
	 */
	@Bean(name = "threadPoolTaskExecutor")
	public ThreadPoolTaskExecutor threadPoolTaskExecutor() {
		if (ok(executor)) {
			return executor;
		}

		executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(20);
		executor.setMaxPoolSize(45);
		// t.setAllowCoreThreadTimeOut(true);
		// t.setKeepAliveSeconds(120);
		return executor;
	}

	public static void shutdown() {
		if (ok(executor)) {
			executor.shutdown();
		}
	}

	/*
	 * DO NOT DELETE (keep for future reference)
	 *
	 * This method is removed because we switched to using the spring.resources.static-locations
	 * property in application.properties file to accomplish loading static files
	 */
	// import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistration;
	// import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
	// import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
	// import org.springframework.web.servlet.config.annotation.WebMvcConfigurerAdapter;

	// @Override
	// public void addResourceHandlers(ResourceHandlerRegistry registry) {

	// /*
	// * This is how we enable the JS files to be edited and tested without doing a rebuild and restart
	// of
	// * server code. We can just run TSC compile to generate the new JS files (or let webpack do that),
	// * and then refresh the browser to reload them. This jsBaseFolder should of course be empty
	// (unused)
	// * in production environment, or any time the JAR (build) should be used exclusively at runtime,
	// * rather than serving from actual directories at runtime
	// *
	// * NOTE: There is another way to do this also:
	// * https://stackoverflow.com/questions/21123437/how-do-i-use-spring-boot-to-serve-static-content-
	// * located-in-dropbox-folder
	// */
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
	public GracefulShutdown gracefulShutdown() {
		return new GracefulShutdown();
	}

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
		int timeout = 30000;
		HttpComponentsClientHttpRequestFactory httpRequestFactory = new HttpComponentsClientHttpRequestFactory();
		httpRequestFactory.setConnectionRequestTimeout(timeout);
		httpRequestFactory.setConnectTimeout(timeout);
		httpRequestFactory.setReadTimeout(timeout);
		return new RestTemplate(httpRequestFactory);
	}

	@Bean
	public ClassLoaderTemplateResolver templateResolver() {
		ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
		templateResolver.setPrefix("templates/");
		templateResolver.setCacheable(!"dev".equals(appProp.getProfileName()));
		templateResolver.setSuffix(".html");
		templateResolver.setTemplateMode("HTML5");
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
