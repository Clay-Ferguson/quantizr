package quanta.model.client;

public class NodeMetaIntf {
	private String id;
	private boolean hasChildren;

	public NodeMetaIntf(String id, boolean hasChildren) {
		this.id = id;
		this.hasChildren = hasChildren;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public boolean isHasChildren() {
		return hasChildren;
	}
	
	public void setHasChildren(boolean hasChildren) {
		this.hasChildren = hasChildren;
	}
}
