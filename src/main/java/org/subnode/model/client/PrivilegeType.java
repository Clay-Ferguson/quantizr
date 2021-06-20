package org.subnode.model.client;

public enum PrivilegeType {
	/* Can read the node and entire subgraph of nodes it contains */
	READ("rd"), //

	/* Can read and write this node. Write to subnodes is not granted by this.

	todo-0: check all code and make sure this isn't used where 'owner requirement' is meant.
	*/
	WRITE("wr"), //

	// todo-0: this one is no longer being used ?
	ADD_CHILDREN("ac"), //

	/*
	 * Can read and and delete children under this node and any nodes in the
	 * subgraph
	 */
	// todo-0: this one is no longer being used ?
	REMOVE_CHILDREN("rc");

	public final String name;

	private PrivilegeType(String name) {
		this.name = name;
	}

	public String toString() {
		return name;
	}

	public String s() {
		return name;
	}
}
