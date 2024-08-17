package quanta.config;

public class NodePath {
    public static final String ROOT = "r";
    public static final String PENDING = "p";
    public static final String USER = "usr";
    public static final String SYSTEM = "sys";
    public static final String PUBLIC = "public";
    public static final String OUTBOX = "outbox";
    public static final String HOME = "home";

    public static final String USERS_PATH = "/" + ROOT + "/" + USER;
    public static final String PENDING_PATH = "/" + ROOT + "/" + PENDING;
    public static final String ROOT_PATH = "/" + ROOT;
    public static final String PUBLIC_PATH = "/" + ROOT + "/" + PUBLIC;

    public static final String PENDING_PATH_S = PENDING_PATH + "/";
    public static final String ROOT_PATH_S = ROOT_PATH + "/";
    public static final String USERS_PATH_S = USERS_PATH + "/";

    // WARNING: There are places in TypeScript where we have `/r/public/home` hardcoded
    public static final String PUBLIC_HOME = PUBLIC_PATH + "/" + HOME;
}
