package quanta.config;

import static quanta.util.Util.no;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import quanta.exception.base.RuntimeEx;

/**
 * Manages certain aspects of Spring application context.
 */

//WARNING: DO NOT USE @Lazy here. That breaks spring.
@Component
public class SpringContextUtil implements ApplicationContextAware {
	private static final Logger log = LoggerFactory.getLogger(SpringContextUtil.class);

	private static ApplicationContext context;

	@Autowired
	@Lazy
	private TestRunner testRunner;


	@Override
	public void setApplicationContext(ApplicationContext context) throws BeansException {
		log.debug("SpringContextUtil initialized context.");
		SpringContextUtil.context = context;
		testRunner.test();
	}

	public static ApplicationContext getApplicationContext() {
		return context;
	}

	public static Object getBean(Class clazz) {
		if (no(context)) {
			throw new RuntimeEx("SpringContextUtil accessed before spring initialized.");
		}

		return context.getBean(clazz);
	}

	public static Object getBean(String name) {
		if (no(context)) {
			throw new RuntimeEx("SpringContextUtil accessed before spring initialized.");
		}

		return context.getBean(name);
	}
}
