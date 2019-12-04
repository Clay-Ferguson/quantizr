package org.subnode.config;

import org.subnode.mongo.MongoRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

/**
 * Manages certain aspects of Spring application context.
 */
@Component
public class SpringContextUtil implements ApplicationContextAware {
	private static final Logger log = LoggerFactory.getLogger(SpringContextUtil.class);

	private static ApplicationContext context;

	@Autowired
	private MongoRepository mongoRepo;

	@Autowired
	private TestRunner testRunner;

	@Override
	public void setApplicationContext(ApplicationContext context) throws BeansException {
		log.debug("SpringContextUtil initialized context.");
		this.context = context;

		try {
			mongoRepo.init();
		}
		catch (Exception e) {
			log.error("application startup failed.");
			throw new RuntimeException(e);
		}

		testRunner.test();
	}

	public static ApplicationContext getApplicationContext() {
		return context;
	}

	public static Object getBean(Class clazz) {
		if (context == null) {
			throw new RuntimeException("SpringContextUtil accessed before spring initialized.");
		}

		return context.getBean(clazz);
	}

	public static Object getBean(String name) {
		if (context == null) {
			throw new RuntimeException("SpringContextUtil accessed before spring initialized.");
		}

		return context.getBean(name);
	}
}
