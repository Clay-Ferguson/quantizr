package org.subnode.config;

/**
 * Node names for architecturally significant system nodes
 */
public class NodeName {
	public static final String ROOT = "r";
	public static final String USER = "usr";
	public static final String SYSTEM = "sys";
	public static final String OUTBOX = "outbox";
	public static final String INBOX = "inbox";
	public static final String FRIEND_LIST = "friendList";
	public static final String USER_FEED = "userFeed";
	public static final String NOTES = "notes";
	public static final String LINKS = "links";	
	public static final String TRASH = "d";

	public static final String PUBLIC = "public";

	public static final String HOME = "home";

	public static final String FILE_SEARCH_RESULTS = "fileSearchResults";
	public static final String FEEDS = "feeds";

	public static final String ROOT_OF_ALL_USERS = "/" + NodeName.ROOT + "/" + NodeName.USER;
}
