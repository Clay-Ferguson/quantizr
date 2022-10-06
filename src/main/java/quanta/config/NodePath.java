package quanta.config;

public class NodePath {
	// todo-1: for efficiency in path length each of these reserved names (at least 'usr' and 'public'
	// should use
	// a single character usr=u, public=c. Will require DB update/conversion.
	public static final String ROOT = "r";
	public static final String PENDING = "p";
	public static final String USER = "usr";
	public static final String SYSTEM = "sys";
	public static final String PUBLIC = "public";
	public static final String OUTBOX = "outbox";

	public static final String USERS_PATH = "/" + ROOT + "/" + USER;
	public static final String PENDING_PATH = "/" + ROOT + "/" + PENDING;
	public static final String ROOT_PATH = "/" + ROOT;
	public static final String PUBLIC_PATH = "/" + ROOT + "/" + PUBLIC;
}
