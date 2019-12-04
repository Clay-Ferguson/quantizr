package org.subnode.response;

import java.util.List;

import org.subnode.model.GraphEdge;
import org.subnode.model.GraphNode;
import org.subnode.response.base.ResponseBase;

public class GraphResponse extends ResponseBase {
	private List<GraphNode> nodes;
	private List<GraphEdge> edges;

	public List<GraphNode> getNodes() {
		return nodes;
	}

	public List<GraphEdge> getEdges() {
		return edges;
	}

	public void setEdges(List<GraphEdge> edges) {
		this.edges = edges;
	}

	public void setNodes(List<GraphNode> nodes) {
		this.nodes = nodes;
	}
}

