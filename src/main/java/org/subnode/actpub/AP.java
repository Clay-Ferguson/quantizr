package org.subnode.actpub;

import java.util.Date;
import java.util.List;
import java.util.Map;

import org.subnode.util.DateUtil;

/**
 * Because the ActivityPup spec has lots of places where the object types are completely variable,
 * there's no way to use perfect type safety on all objects, so instead we use this purely generic
 * approach to traverse the incomming JSON trees of content
 */
public class AP {
    public static final String id = "id";
    public static final String context = "@context";
    public static final String type = "type";
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
    public static final String replyTo = "replyTo";
    public static final String endpoints = "endpoints";
    public static final String publicKey = "publicKey";
    public static final String publicKeyPem = "publicKeyPem";
    public static final String owner = "owner";
    public static final String supportsFriendRequests = "supportsFriendRequests";

    public static boolean hasProps(Object obj) {
        return obj instanceof Map<?, ?>;
    }

    public static String str(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return null;
            } else if (val instanceof String) {
                return (String) val;
            } else {
                throw new RuntimeException(
                        "unhandled type on str() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on str(): " + (obj != null ? obj.getClass().getName() : "null"));
    }

    public static Boolean bool(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return null;
            } else if (val instanceof String) {
                return ((String) val).equalsIgnoreCase(APConst.STR_TRUE);
            } else if (val instanceof Boolean) {
                return ((Boolean) val).booleanValue();
            } else {
                throw new RuntimeException(
                        "unhandled type on bool() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on bool(): " + (obj != null ? obj.getClass().getName() : "null"));
    }

    public static Date date(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return null;
            } else if (val instanceof String) {
                return DateUtil.parseISOTime((String) val);
            } else {
                throw new RuntimeException(
                        "unhandled type on date() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on date(): " + (obj != null ? obj.getClass().getName() : "null"));
    }

    public static List<?> list(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return null;
            } else if (val instanceof List<?>) {
                return (List<?>) val;
            } else {
                throw new RuntimeException(
                        "unhandled type on list() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on list(): " + (obj != null ? obj.getClass().getName() : "null"));
    }

    public static Object obj(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            return ((Map<?, ?>) obj).get(prop);
        }
        throw new RuntimeException("unhandled type on obj(): " + (obj != null ? obj.getClass().getName() : "null"));
    }
}
