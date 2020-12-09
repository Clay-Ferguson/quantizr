package org.subnode.actpub;

public interface VisitAPObj {
    // Return false to signal stopping iteration
	public boolean visit(APObj obj);
}