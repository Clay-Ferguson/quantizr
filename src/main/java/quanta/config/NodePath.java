package quanta.config;

public class NodePath {
	// todo-0: for efficiency in path length each of these reserved names (at least 'usr' and 'public' should use
	// a single character usr=u, public=c. Will require DB update, or else it would be easy.
	public static final String ROOT = "r";
	public static final String USER = "usr";
	public static final String SYSTEM = "sys";
	public static final String PUBLIC = "public";
	public static final String OUTBOX = "outbox";
	public static final String ROOT_OF_ALL_USERS = "/" + NodePath.ROOT + "/" + NodePath.USER;
	public static final String PENDING_PATH = "/" + NodePath.ROOT + "/p";
}
