package org.subnode.util;

public class NodeAuthFailedException extends RuntimeEx {
    public NodeAuthFailedException() {
        super("Unauthorized");
    }
}
