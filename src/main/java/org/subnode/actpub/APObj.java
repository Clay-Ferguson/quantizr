package org.subnode.actpub;

import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.subnode.util.DateUtil;

/* The objects in the ActivityPub Spec are so highly variable that we cannot determine
ahead of time what the shape (types) of any reply will be so the best approach is to just use a map */
public class APObj extends HashMap<String, Object> {
    private static final long serialVersionUID = 1L;

    public APObj() {
    }

    public APObj(Object payload) {
        if (payload instanceof LinkedHashMap<?, ?>) {
            putAll((Map<? extends String, ? extends Object>) payload);
            return;
        }
        throw new RuntimeException("Unknown payload type: " + payload.getClass().getName());
    }

    public Date getDate(String prop) {
        String date = getStr(prop);
        if (date != null) {
            return DateUtil.parseISOTime(date);
        }
        return null;
    }

    public APObj getAPObj(String prop) {
        Object obj = get(prop);
        if (obj instanceof APObj) {
            return (APObj) obj;
        }
        return new APObj(obj);
    }

    public String getStr(String prop) {
        return (String) get(prop);
    }

    public List<Object> getList(String prop) {
        return (List<Object>) get(prop);
    }
}
