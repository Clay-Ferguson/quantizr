package quanta.actpub.model;

import java.util.HashMap;

/**
 * The objects in the ActivityPub Spec are so highly variable that we cannot determine ahead of time
 * what the shape (types) of any reply will be so the best approach is to just use a map.
 * 
 * todo-2: Consider a refactor to use: org.json.JSONObject, and org.json.JSONArray, instead of this APObj
 */
public class APObj extends HashMap<String, Object> {
    private static final long serialVersionUID = 1L;

    public static final String id = "id";
    public static final String context = "@context";
    public static final String type = "type";
    public static final String did = "did";
    public static final String language = "language";
    public static final String object = "object";
    public static final String actor = "actor";
    public static final String published = "published";
    public static final String url = "url";
    public static final String inReplyTo = "inReplyTo";
    public static final String summary = "summary";
    public static final String followers = "followers";
    public static final String following = "following";
    public static final String preferredUsername = "preferredUsername";
    public static final String name = "name";
    public static final String mediaType = "mediaType";
    public static final String icon = "icon";
    public static final String image = "image";
    public static final String inbox = "inbox";
    public static final String sharedInbox = "sharedInbox";
    public static final String outbox = "outbox";
    public static final String totalItems = "totalItems";
    public static final String first = "first";
    public static final String next = "next";
    public static final String last = "last";
    public static final String href = "href";
    public static final String subject = "subject";
    public static final String links = "links";
    public static final String to = "to";
    public static final String cc = "cc";
    public static final String attachment = "attachment";
    public static final String attributedTo = "attributedTo";
    public static final String sensitive = "sensitive";
    public static final String content = "content";
    public static final String tag = "tag";
    public static final String orderedItems = "orderedItems";
    public static final String partOf = "partOf";
    public static final String rel = "rel";
    public static final String endpoints = "endpoints";
    public static final String publicKey = "publicKey";
    public static final String publicKeyPem = "publicKeyPem";
    public static final String owner = "owner";
    public static final String supportsFriendRequests = "supportsFriendRequests";

    public APObj() {}

    public APObj put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
