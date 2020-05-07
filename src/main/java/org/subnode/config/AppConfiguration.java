package org.subnode.config;

import java.io.File;
import java.util.List;

import org.subnode.util.XString;

import org.apache.catalina.Context;
import org.apache.catalina.connector.Connector;
import org.apache.commons.lang3.StringUtils;
import org.apache.tomcat.util.descriptor.web.SecurityCollection;
import org.apache.tomcat.util.descriptor.web.SecurityConstraint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.servlet.server.ServletWebServerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Standard Spring WebMvcConfigurerAdapter-derived class.
 */
@Configuration
public class AppConfiguration implements WebMvcConfigurer {
	private static final Logger log = LoggerFactory.getLogger(AppConfiguration.class);

	@Autowired
	private AppProp appProp;

	@Bean
	public WebMvcConfigurer corsConfigurer() {
		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(CorsRegistry registry) {
				registry.addMapping("/**")
						.allowedOrigins("https://" + appProp.getMetaHost() + ":" + appProp.getServerPort());
			}
		};
	}

	/*
	 * To avoid error message during startup
	 * "No qualifying bean of type 'org.springframework.scheduling.TaskScheduler' available"
	 * we have to provide spring with a Task Scheduler.
	 */
	@Bean
	public TaskScheduler taskScheduler() {
		return new ConcurrentTaskScheduler(); // single threaded by default
	}

	@Override
	public void addViewControllers(ViewControllerRegistry registry) {
		ViewControllerRegistration reg = registry.addViewController("/");
		reg.setViewName("forward:/index.html");

		ViewControllerRegistration reg2 = registry.addViewController("/r/**");
		reg2.setViewName("forward:/index.html");
	}

	// DO NOT DELETE.
	// Leave as another way to show how to provide a bean by name in the spring
	// context
	// @Bean(name = "constantsProvider")
	// public ConstantsProvider constantsProvider() {
	// //return new ConstantsProviderImpl();
	// return (ConstantsProvider)
	// SpringContextUtil.getBean(ConstantsProviderImpl.class);
	// }

	// @Bean
	// public WebMvcConfigurerAdapter forwardToIndex() {
	// return new WebMvcConfigurerAdapter() {
	// @Override
	// public void addViewControllers(ViewControllerRegistry registry) {
	// // forward requests to /admin and /user to their index.html
	// registry.addViewController("/").setViewName("forward:/index.html");
	// // registry.addViewController("/user").setViewName(
	// // "forward:/user/index.html");
	// }
	// };
	// }

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		// registry
		// .addResourceHandler("/public/**")
		// .addResourceLocations("/public/");

		/*
		 * This is how we enable the JS files to be edited and tested without doing a
		 * rebuild and restart of server code. We can just run TSC compile to generate
		 * the new JS files (or let webpack do that), and then refresh the browser to
		 * reload them. This jsBaseFolder should of course be empty (unused) in
		 * production environment, or any time the JAR (build) should be used
		 * exclusively at runtime, rather than serving from actual directories at
		 * runtime
		 * 
		 * NOTE: There is another way to do this also:
		 * https://stackoverflow.com/questions/21123437/how-do-i-use-spring-boot-to-
		 * serve-static-content-located-in-dropbox-folder
		 */
		// if (!StringUtils.isEmpty(appProp.getJsBaseFolder())) {
		// ResourceHandlerRegistration reg = registry.addResourceHandler("/js/**");

		// List<String> folders = XString.tokenize(appProp.getJsBaseFolder(), ",",
		// true);
		// if (folders != null) {
		// for (String folder : folders) {
		// reg.addResourceLocations(folder);
		// }
		// }
		// }

		/*
		 * I was using this property as a way to be able to load resources directly out
		 * of todo-1: the 'resourceBaseFolder' can actually be removed now, but just for
		 * a short time I want to leave it in place, before I comment out. I will not be
		 * deleting but commenting.
		 */
		if (!StringUtils.isEmpty(appProp.getResourcesBaseFolder())) {

			ResourceHandlerRegistration reg = registry.addResourceHandler("/**");

			List<String> folders = XString.tokenize(appProp.getResourcesBaseFolder(), ",", true);
			if (folders != null) {
				for (String folder : folders) {

					File dir = new File(folder);
					if (dir.isDirectory()) {
						log.error("Live Resources Dir not found: " + folder);
					} else {
						log.debug("Live Resource Dir found ok:" + folder);
					}
					reg.addResourceLocations(folder);
				}
			}
		}

		// if (!StringUtils.isEmpty(appProp.getJsBaseFolder())) {
		// ResourceHandlerRegistration reg = registry.addResourceHandler("/**");

		// //remove hardcoded value. was only a test.
		// //List<String> folders =
		// XString.tokenize("file:///home/clay/ferguson/SubNode-Project/src/main/resources/public/",
		// ",", true);
		// //if (folders != null) {
		// // for (String folder : folders) {
		// reg.addResourceLocations("");
		// // }
		// //}
		// }
	}

	// @PostConstruct
	// public void extension() {
	//// FileTemplateResolver resolver = new FileTemplateResolver();
	//// resolver.setPrefix("D:\\templates\\");
	//// resolver.setSuffix(".html");
	//// resolver.setTemplateMode("HTML5");
	//// resolver.setOrder(templateEngine.getTemplateResolvers().size());
	//// resolver.setCacheable(false);
	//
	// ServletContextTemplateResolver webTemplateResolver = new
	// ServletContextTemplateResolver();
	// webTemplateResolver.setPrefix("/templates/");
	// webTemplateResolver.setSuffix(".xml");
	// webTemplateResolver.setTemplateMode("HTML5");
	// webTemplateResolver.setCharacterEncoding("UTF-8");
	// webTemplateResolver.setOrder(1);
	// //templatesResolvers.add(webTemplateResolver);
	//
	// templateEngine.addTemplateResolver(webTemplateResolver);
	// }

	///////////////////////////////////////////////////////////////////////////////////////

	// specify server.port=8443

	// @Bean
	// public ServletWebServerFactory servletContainer() {
	// TomcatServletWebServerFactory tomcat = new TomcatServletWebServerFactory();
	// tomcat.addAdditionalTomcatConnectors(createStandardConnector());
	// return tomcat;
	// }

	// private Connector createStandardConnector() {
	// Connector connector = new
	// Connector("org.apache.coyote.http11.Http11NioProtocol");
	// connector.setPort(0);
	// return connector;
	// }

	@Bean
	public ServletWebServerFactory servletContainer(/* final GracefulShutdown gracefulShutdown */) {
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

		// factory.addConnectorCustomizers(gracefulShutdown);
		return factory;
	}

	/* Need to revisit this after adding https support ? */
	private Connector redirectConnector() {
		Connector connector = new Connector(
				TomcatServletWebServerFactory.DEFAULT_PROTOCOL /* "org.apache.coyote.http11.Http11NioProtocol" */);
		connector.setScheme("http");
		connector.setPort(80);
		connector.setSecure(false);
		connector.setRedirectPort(443);
		return connector;
	}

	// @Bean
	// public GracefulShutdown gracefulShutdown() {
	// return new GracefulShutdown();
	// }

	@Bean
	@Scope("singleton")
	public RestTemplate restTemplate() {
		HttpComponentsClientHttpRequestFactory httpRequestFactory = new HttpComponentsClientHttpRequestFactory();
		// int timeout = ???
		// httpRequestFactory.setConnectionRequestTimeout(timeout);
		// httpRequestFactory.setConnectTimeout(timeout);
		// httpRequestFactory.setReadTimeout(timeout);
		return new RestTemplate(httpRequestFactory);
	}
}