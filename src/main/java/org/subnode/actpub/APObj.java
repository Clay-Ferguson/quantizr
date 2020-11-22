package org.subnode.actpub;

import java.util.HashMap;
import java.util.List;

/* The objects in the ActivityPub Spec are so highly variable that we cannot determine
ahead of time what the shape (types) of any reply will be so the best approach is to just use a map */
public class APObj extends HashMap<String, Object> {
    private static final long serialVersionUID = 1L;

    public APObj() {
    }

    public String getStr(String prop) {
        return (String) get(prop);
    }

    public List<Object> getList(String prop) {
        return (List<Object>) get(prop);
    }
}
