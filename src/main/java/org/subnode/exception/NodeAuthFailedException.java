package org.subnode.exception;

import org.subnode.exception.base.RuntimeEx;

public class NodeAuthFailedException extends RuntimeEx {
    public NodeAuthFailedException() {
        super("Unauthorized");
    }
}
