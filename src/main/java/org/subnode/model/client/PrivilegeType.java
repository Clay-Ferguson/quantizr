package org.subnode.model.client;

public enum PrivilegeType {
	/* Can read the node and entire subgraph of nodes it contains */
	READ("rd"), //

	/* Can read and write this node. Write to subnodes is not granted by this */
	WRITE("wr"), //

	/* Can read and create children under this node and any nodes in the subgraph 
	
	need to rethink if I need add_children or not, because WRITE has been used for that for a while I think (todo-1)
	*/
	ADD_CHILDREN("ac"), //

	/*
	 * Can read and and delete children under this node and any nodes in the
	 * subgraph
	 */
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
