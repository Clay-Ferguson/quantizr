package org.subnode.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Dead class. I want to keep it for future reference.
 */
@Component
public class ResourceManager {
	private static final Logger log = LoggerFactory.getLogger(ResourceManager.class);

	// we use initialized to support lazy init.
	private boolean initialized;

	private void init() {
		if (initialized) return;
		initialized = true;

		// This is part of a work in progress.
		// Commented code works fine but is not yet needed.

		// PathMatchingResourcePatternResolver resolver = new
		// PathMatchingResourcePatternResolver();
		// try {
		// Resource[] resources =
		// resolver.getResources("classpath*:/public/**/*.*");
		// for (Resource res : resources) {
		// System.out.println("Resource: URI: " + res.getURI() + " URL: " +
		// res.getURL());
		// }
		// } catch (IOException e) {
		// e.printStackTrace();
		// }
	}
}
