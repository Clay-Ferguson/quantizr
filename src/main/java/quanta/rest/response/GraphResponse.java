
package quanta.rest.response;

import quanta.model.GraphNode;
import quanta.rest.response.base.ResponseBase;

public class GraphResponse extends ResponseBase {
	private GraphNode rootNode;
	
	public GraphNode getRootNode() {
		return this.rootNode;
	}
	
	public void setRootNode(final GraphNode rootNode) {
		this.rootNode = rootNode;
	}

	public GraphResponse() {
	}
}
