package org.subnode.actpub.model;

import java.util.HashMap;

/**
 * The objects in the ActivityPub Spec are so highly variable that we cannot determine ahead of time
 * what the shape (types) of any reply will be so the best approach is to just use a map.
 * 
 * todo-1: Need to refactor code to use: org.json.JSONObject, and org.json.JSONArray, instead of this APObj
 */
public class APObj extends HashMap<String, Object> {
    private static final long serialVersionUID = 1L;

    public APObj() {}

    public APObj put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
