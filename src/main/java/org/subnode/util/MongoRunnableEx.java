package org.subnode.util;

import org.subnode.mongo.MongoSession;

/**
 * Runs a unit of work in a specific mongo session, and return an object. Used in Java-8 "Lambda" call pattern.
 */
public interface MongoRunnableEx {
	public Object run(MongoSession session);
}
