package org.subnode.actpub;

public interface VisitAPObj {
    // Returns false to signal stopping iteration
	public boolean visit(APObj obj);
}