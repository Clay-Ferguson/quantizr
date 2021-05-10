package org.subnode.actpub.model;

/**
 * Mention object.
 */
public class APOMention extends APObj {
    public APOMention() {
        put(AP.type, APType.Mention);
    }
}
