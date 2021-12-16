package quanta.config;

public class NodePath {
	public static final String ROOT = "r";
	public static final String USER = "usr";
	public static final String SYSTEM = "sys";
	public static final String PUBLIC = "public";
	public static final String OUTBOX = "outbox";
	public static final String ROOT_OF_ALL_USERS = "/" + NodePath.ROOT + "/" + NodePath.USER;
	public static final String PENDING_PATH = "/" + NodePath.ROOT + "/p";
}
