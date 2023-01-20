package quanta.actpub;

import java.util.Map;
import org.springframework.http.MediaType;
import quanta.model.client.PrivilegeType;

/**
 * Ap-related constants.
 */
public class APConst {
    public static final String PATH_WEBFINGER = "/.well-known/webfinger";
    public static final String PATH_AP = "/ap";
    public static final String PATH_INBOX = "/ap/inbox";
    public static final String PATH_OUTBOX = "/ap/outbox";
    public static final String PATH_FOLLOWERS = "/ap/followers";
    public static final String PATH_FOLLOWING = "/ap/following";
    public static final String ACTOR_PATH = "/ap/u";

    public static final String CONTEXT_STREAMS = "https://www.w3.org/ns/activitystreams";
    public static final String CONTEXT_SECURITY = "https://w3id.org/security/v1";
    public static final String CONTEXT_STREAMS_PUBLIC = CONTEXT_STREAMS + "#Public";

    public static final String CHARSET = "charset=utf-8";
    public static final String APS_PROFILE = "profile=\"https://www.w3.org/ns/activitystreams\"";

    public static final String CTYPE_HTML = "text/html";
    public static final String CTYPE_ACT_JSON = "application/activity+json";
    public static final String CTYPE_LD_JSON = "application/ld+json";
    public static final String CTYPE_JRD_JSON = "application/jrd+json";

    // todo-1: added 2/12/22 (need to verify this is correct)
    // (Mastodon was tolerating this, but other servers may not. Anyway leave commented for a while
    // in case it broke something)
    // public static final MediaType MTYPE_ACT_JSON_CHARSET = new MediaType("application", "activity+json", StandardCharsets.UTF_8);
    // public static final MediaType MTYPE_JRD_JSON_CHARSET = new MediaType("application", "jrd+json", StandardCharsets.UTF_8);

    public static final MediaType MTYPE_ACT_JSON = new MediaType("application", "activity+json");
    public static final MediaType MTYPE_JSON = new MediaType("application", "json");
    // public static final MediaType MTYPE_LD_JSON = new MediaType("application", "ld+json");
    public static final MediaType MTYPE_JRD_JSON = new MediaType("application", "jrd+json");

    // Note: does this need a charset?
    // Note: Smitherene does it like this: 
    //    MediaType.parse("application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"")
    public static final MediaType MTYPE_LD_JSON_PROF =
            new MediaType("application", "ld+json", Map.of("profile", "\"https://www.w3.org/ns/activitystreams\""));

    public static final String TRUE = "true";

    public static final String RDWR = PrivilegeType.READ.s() + "," + PrivilegeType.WRITE.s();

    // Don't include '@'' or # or '.', because this tokenizer is for finding tags and mentions, and the dot
    // will be part of the username potentially (like in "person@instance.com")
    public static final String TAGS_TOKENIZER = " \n\r\t,;!<>?()+";
}
