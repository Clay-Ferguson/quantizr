package quanta.actpub.model;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.actpub.APConst;
import quanta.util.DateUtil;
import quanta.util.Val;
import quanta.util.XString;

/**
 * Because the ActivityPup spec has lots of places where the object types are completely variable,
 * there's no clean way to use perfect type safety on all objects (hard coded properties), so
 * instead of having a POJO for the the various types of objects we use the accessor methods and
 * properties in this object.
 */
public class AP {
    private static final Logger log = LoggerFactory.getLogger(AP.class);

    public static boolean hasProps(Object obj) {
        return obj instanceof Map<?, ?>;
    }

    public static boolean isType(Object obj, String type) {
        if (no(obj))
            return false;
        return type.equalsIgnoreCase(str(obj, APObj.type));
    }

    public static String str(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return null;
            } else if (val.getVal() instanceof String) {
                return (String) val.getVal();
            } else if (val.getVal() instanceof ArrayList) {
                log.error("Attempted to read prop " + prop + " from the following object as a string but it was an array: "
                        + XString.prettyPrint(obj));
                return null;
            } else {
                log.error("unhandled type on str() return val: " + (ok(val.getVal()) ? val.getVal().getClass().getName()
                        : "null\n\non object:" + XString.prettyPrint(obj)));
                return null;
            }
        } else if (obj instanceof String) {
            return (String) obj;
        }

        log.warn("unhandled type on str(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        return null;
    }

    public static Boolean bool(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return false;
            } else if (val.getVal() instanceof String) {
                return ((String) val.getVal()).equalsIgnoreCase(APConst.TRUE);
            } else if (val.getVal() instanceof Boolean) {
                return ((Boolean) val.getVal()).booleanValue();
            }
        } else if (obj instanceof Boolean) {
            return (Boolean) obj;
        }

        log.warn("unhandled type on bool(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        return false;
    }

    public static Integer integer(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return 0;
            } else if (val.getVal() instanceof Integer) {
                return ((Integer) val.getVal()).intValue();
            } else if (val.getVal() instanceof Long) {
                return ((Long) val.getVal()).intValue();
            } else if (val.getVal() instanceof String) {
                return Integer.valueOf((String) val.getVal());
            }
        } else if (obj instanceof Integer) {
            return (Integer) obj;
        } else if (obj instanceof Long) {
            return ((Long) obj).intValue();
        }

        log.warn("unhandled type on integer(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        return 0;
    }

    public static Date date(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return null;
            } else if (val.getVal() instanceof String) {
                return DateUtil.parseISOTime((String) val.getVal());
            }
        } else if (obj instanceof Date) {
            return (Date) obj;
        }

        log.warn("unhandled type on date(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        return null;
    }

    public static List<?> list(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return null;
            } else if (val.getVal() instanceof List<?>) {
                return (List<?>) val.getVal();
            }
        }

        log.warn("unhandled type on list(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        return null;
    }

    // instanceof Map won't always work as instanceof when LinkedHashMap
    public static Val<Object> getFromMap(Object obj, String prop) {
        if (obj instanceof LinkedHashMap<?, ?>) {
            return new Val<Object>(((LinkedHashMap<?, ?>) obj).get(prop));
        } else if (obj instanceof Map<?, ?>) {
            return new Val<Object>(((Map<?, ?>) obj).get(prop));
        }
        return null;
    }

    public static Object obj(Object obj, String prop) {
        if (obj instanceof Map<?, ?>) {
            return ((Map<?, ?>) obj).get(prop);
        } else if (obj instanceof LinkedHashMap<?, ?>) {
            return ((LinkedHashMap<?, ?>) obj).get(prop);
        }
        log.warn("getting prop " + prop + " from unsupported container type: " + (ok(obj) ? obj.getClass().getName() : "null"));
        return null;
    }
}
