package org.subnode.model.client;

/* 
 * *************** WARNING: right now the these strings are also hardcoded into some TypeScript.
 */
public enum PrivilegeType {
	/* Can read the node and entire subgraph of nodes it contains */
	READ(1, "rd"), //

	/* Can read and write this node. Write to subnodes is not granted by this */
	WRITE(2, "wr"), //

	/* Can read and create children under this node and any nodes in the subgraph */
	ADD_CHILDREN(3, "ac"), //

	/*
	 * Can read and and delete children under this node and any nodes in the
	 * subgraph
	 */
	REMOVE_CHILDREN(4, "rc");

	//public final int val;
	public final String name;

	private PrivilegeType(int val, String name) {
		//this.val = val;
		this.name = name;
	}

	public String toString() {
		return name;
	}

	public String s() {
		return name;
	}
}
