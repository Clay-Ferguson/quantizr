# Code removed from AppConfiguration.java that I don't want to delete yet/ever

    // turned off to test ActivityPub, and is not longer needed.
	// @Bean
	// public WebMvcConfigurer corsConfigurer() {
	// return new WebMvcConfigurer() {
	// @Override
	// public void addCorsMappings(CorsRegistry registry) {
	// registry.addMapping("/**")
	// .allowedOrigins("https://" + appProp.getMetaHost() + ":" +
	// appProp.getServerPort());
	// }
	// };
	// }

    	// we don't need this.
	// @Override
	// public void addViewControllers(ViewControllerRegistry registry) {
	// ViewControllerRegistration reg = registry.addViewController("/");
	// reg.setViewName("forward:/index.html");
	// }

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

	/* another way to do some of the code below, related to the GracefulShutdown */
	// @Bean
	// public ConfigurableServletWebServerFactory webServerFactory(final
	// GracefulShutdown gracefulShutdown) {
	// TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory();
	// factory.addConnectorCustomizers(gracefulShutdown);
	// return factory;
	// }

    	///////////////////////////////
	// Thymeleaf
	// available resolver types
	// -ClassLoaderTemplateResolver
	// -FileTemplateResolver
	// -ServletContextTemplateResolver
	// -UrlTemplateResolver
	///////////////////////////////

	// @Bean
	// public ServletContextTemplateResolver templateResolver() {
	// ServletContextTemplateResolver templateResolver = new
	// ServletContextTemplateResolver(null);
	// templateResolver.setPrefix("/WEB-INF/templates/");
	// templateResolver.setSuffix(".html");
	// templateResolver.setTemplateMode("HTML5");
	// return templateResolver;
	// }

	// @Bean
	// public SpringTemplateEngine templateEngine() {
	// SpringTemplateEngine templateEngine = new SpringTemplateEngine();
	// templateEngine.setTemplateResolver(templateResolver());
	// //templateEngine.setTemplateEngineMessageSource(messageSource());
	// return templateEngine;
	// }

	// // @Bean
	// // public ResourceBundleMessageSource messageSource() {
	// // ResourceBundleMessageSource messageSource = new
	// ResourceBundleMessageSource();
	// // messageSource.setBasename("messages");
	// // return messageSource;
	// // }

