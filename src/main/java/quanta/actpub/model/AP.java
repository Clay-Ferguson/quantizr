package quanta.actpub.model;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.ArrayList;
import java.util.Arrays;
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

    public static boolean apHasProps(Object obj) {
        return obj instanceof Map<?, ?> || obj instanceof LinkedHashMap<?, ?>;
    }

    public static boolean apIsType(Object obj, String type) {
        if (no(obj))
            return false;
        return type.equalsIgnoreCase(apStr(obj, APObj.type));
    }

    public static String apStr(Object obj, String prop) {
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
                log.error("unhandled type on str() return val: "
                        + (ok(val.getVal()) ? val.getVal().getClass().getName() : "null on object"));
                log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
                return null;
            }
        }

        log.warn("unhandled type on apStr(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return null;
    }

    public static Boolean apBool(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return false;
            } else if (val.getVal() instanceof String) {
                return ((String) val.getVal()).equalsIgnoreCase(APConst.TRUE);
            } else if (val.getVal() instanceof Boolean) {
                return ((Boolean) val.getVal()).booleanValue();
            }
        }

        log.warn("unhandled type on apBool(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return false;
    }

    public static Integer apInt(Object obj, String prop) {
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
        }

        log.warn("unhandled type on apInt(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return 0;
    }

    public static Date apDate(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return null;
            } else if (val.getVal() instanceof String) {
                return DateUtil.parseISOTime((String) val.getVal());
            }
        }

        log.warn("unhandled type on apDate(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return null;
    }

    public static List<?> apList(Object obj, String prop) {
        Val<Object> val = null;

        if (ok(val = getFromMap(obj, prop))) {
            if (no(val.getVal())) {
                return null;
            }
            // if we got an instance of a list return it 
            else if (val.getVal() instanceof List<?>) {
                return (List<?>) val.getVal();
            }
            // if we expected a list and found a String, that's ok, return a list with one entry
            // the address 'to' and 'cc' properties can have this happen often.
            else if (val.getVal() instanceof String) {
                return Arrays.asList(val.getVal());
            }
        }

        log.warn("unhandled type on apList(): " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return null;
    }

    public static Object apObj(Object obj, String prop) {
        if (obj instanceof LinkedHashMap<?, ?>) {
            return ((LinkedHashMap<?, ?>) obj).get(prop);
        } //
        else if (obj instanceof Map<?, ?>) {
            return ((Map<?, ?>) obj).get(prop);
        }
        log.warn("getting prop " + prop + " from unsupported container type: " + (ok(obj) ? obj.getClass().getName() : "null"));
        log.debug("Unable to get property " + prop + " from obj " + XString.prettyPrint(obj));
        return null;
    }

    // instanceof Map won't always work as instanceof when LinkedHashMap
    private static Val<Object> getFromMap(Object obj, String prop) {
        if (obj instanceof LinkedHashMap<?, ?>) {
            return new Val<Object>(((LinkedHashMap<?, ?>) obj).get(prop));
        } //
        else if (obj instanceof Map<?, ?>) {
            return new Val<Object>(((Map<?, ?>) obj).get(prop));
        }
        return null;
    }
}
