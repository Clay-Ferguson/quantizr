package quanta.config;

import static quanta.util.Util.no;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import quanta.exception.base.RuntimeEx;

/**
 * Manages certain aspects of Spring application context.
 */
@Component
public class SpringContextUtil {
	private static final Logger log = LoggerFactory.getLogger(SpringContextUtil.class);

	// WARNING: Trying to @Autowire context here did NOT work. Not sure if it was because of the 'static'
	// I needed here, but this entire class actually can go away and is no longer serving a purpose
	// due to other design changes.
	private static ApplicationContext context;

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		context = event.getApplicationContext();
		log.debug("SpringContextUtil.ContextRefreshedEvent context=" + context.hashCode());
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
