package org.subnode.actpub.model;

/**
 * Mention object.
 */
public class APOMention extends APObj {
    // to be consistent maybe this constructor like all the rest
    // should NOT take any args (todo-0)
    public APOMention(String href, String name) {
        put(AP.type, APType.Mention);
        put(AP.href, href);
		put(AP.name, name);
    }
}
