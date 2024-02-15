package quanta.util;

import quanta.model.client.PrivilegeType;

public class Const {
    public static final String REL_FOREIGN_LINK = "nofollow noopener noreferrer";
    public static final int MAX_BULK_OPS = 500;
    public static final int ONE_MB = 1024 * 1024;
    public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;
    public static final String FAKE_USER_AGENT =
            "Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Type: Desktop";

    public static final boolean adminDebugStreaming = false;
    public static final boolean debugFilterEntry = false;

    public static String BEARER_TOKEN = "token";
    public static String HOME_NODE_NAME = "home";
    public static final String RDWR = PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s();
}
