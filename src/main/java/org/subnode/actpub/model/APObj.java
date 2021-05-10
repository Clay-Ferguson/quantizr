package org.subnode.actpub.model;

import java.util.HashMap;

/**
 * The objects in the ActivityPub Spec are so highly variable that we cannot determine ahead of time
 * what the shape (types) of any reply will be so the best approach is to just use a map
 */
public class APObj extends HashMap<String, Object> {
    private static final long serialVersionUID = 1L;

    public APObj() {}

    public APObj put(String key, Object val) {
        super.put(key, val);
        return this;
    }

    static protected APObj newContextObj() {
        return new APObj() //
                /*
                 * todo-1: How does this language relate to the other format inside the @context object where we
                 * have '@language' inside and object stored on the '@context' object ?
                 */
                .put("language", "en"); //

                /*
                 * todo-0: I put this here very early on during mastodon testing. Need to see if we can get rid of
                 * this, and still be 'compatible' with Mastodon.
                 */
                //.put("toot", "http://joinmastodon.org/ns#");
    }
}
