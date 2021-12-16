package quanta.config;

/**
 * 
 * todo-2: some of these are used for 'node.name' on nodes, and some of them are used as a path part
 * in one path on the 'node.pth' property. Need to do an audit of all of this and make it
 * consistent, and create a class called NodePathName to hold the path ones.
 */
public class NodeName {
	public static final String HOME = "home";
	public static final String INBOX = "inbox";
	public static final String FRIENDS = "friends";
	public static final String BLOCKED_USERS = "blocked";
	public static final String POSTS = "posts";
	public static final String WELCOME = "welcome";
}
