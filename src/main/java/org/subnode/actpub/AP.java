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
                return ((String) val).equalsIgnoreCase(ActPubConstants.STR_TRUE);
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
