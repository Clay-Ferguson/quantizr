package quanta.response;

import quanta.model.GraphNode;
import quanta.response.base.ResponseBase;

public class GraphResponse extends ResponseBase {
	private GraphNode rootNode;

	public GraphNode getRootNode() {
		return rootNode;
	}

	public void setRootNode(GraphNode rootNode) {
		this.rootNode = rootNode;
	}
}

