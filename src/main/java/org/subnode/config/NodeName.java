package org.subnode.config;

/**
 * Node "path names" for special system nodes. Note: Most nodes are identified only by the record
 * ID being in the path name but a small set have these names.
 */
public class NodeName {
	public static final String ROOT = "r";
	public static final String USER = "usr";
	public static final String SYSTEM = "sys";
	public static final String LINKS = "links";	
	public static final String PUBLIC = "public";
	public static final String HOME = "home";
	public static final String WELCOME = "welcome";
	public static final String FEEDS = "feeds";
	public static final String ROOT_OF_ALL_USERS = "/" + NodeName.ROOT + "/" + NodeName.USER;
	public static final String PENDING_PATH = "/" + NodeName.ROOT + "/p";
}
