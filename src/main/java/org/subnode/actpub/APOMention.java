package org.subnode.actpub;

/**
 * Mention object.
 */
public class APOMention extends APObj {
    public APOMention() {
        put(AP.type, APType.Mention);
    }
}
