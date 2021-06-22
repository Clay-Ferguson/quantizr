package org.subnode.actpub.model;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.subnode.actpub.APConst;
import org.subnode.util.DateUtil;
import org.subnode.util.XString;

/**
 * Because the ActivityPup spec has lots of places where the object types are completely variable,
 * there's no way to use perfect type safety on all objects, so instead of having a POJO for the the
 * various types of objects we use the accessor methods and properties in this object.
 */
public class AP {
    private static final Logger log = LoggerFactory.getLogger(AP.class);

    public static boolean hasProps(Object obj) {
        return obj instanceof Map<?, ?>;
    }

    public static boolean isType(Object obj, String type) {
        if (obj == null)
            return false;
        return type.equalsIgnoreCase(str(obj, APProp.type));
    }

    public static String str(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return null;
            } else if (val instanceof String) {
                return (String) val;
            } else if (val instanceof ArrayList) {
                log.error("Attempted to read prop " + prop + " from the following object as a string but it was an array: "
                        + XString.prettyPrint(obj));
                return null;
            } else {
                log.error("unhandled type on str() return val: "
                        + (val != null ? val.getClass().getName() : "null\n\non object:" + XString.prettyPrint(obj)));
                return null;
            }
        } else {
            return null;
        }
        // throw new RuntimeException("unhandled type on str(): " + (obj != null ? obj.getClass().getName()
        // : "null"));
    }

    public static Boolean bool(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return false;
            } else if (val instanceof String) {
                return ((String) val).equalsIgnoreCase(APConst.TRUE);
            } else if (val instanceof Boolean) {
                return ((Boolean) val).booleanValue();
            } else {
                throw new RuntimeException(
                        "unhandled type on bool() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on bool(): " + (obj != null ? obj.getClass().getName() : "null"));
    }

    public static Integer integer(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            Object val = ((Map<?, ?>) obj).get(prop);
            if (val == null) {
                return 0;
            } else if (val instanceof Integer) {
                return ((Integer) val).intValue();
            } else if (val instanceof Long) {
                return ((Long) val).intValue();
            }else if (val instanceof String) {
                return Integer.valueOf((String) val);
            } else {
                throw new RuntimeException(
                        "unhandled type on integer() return val: " + (val != null ? val.getClass().getName() : "null"));
            }
        }
        throw new RuntimeException("unhandled type on integer(): " + (obj != null ? obj.getClass().getName() : "null"));
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
