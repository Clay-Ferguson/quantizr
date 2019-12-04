package org.subnode.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.subnode.request.base.RequestBase;

public class RenderNodeRequest extends RequestBase {

	/* can be node id or path. server interprets correctly no matter which */
	private String nodeId;

	/*
	 * offset for render of a child node which works like OFFSET on RDBMS. It's the point at which
	 * we start gathering nodes to return (or the number to skip over), use for pagination support.
	 * In other words, offset is the index of the first child to render in the results.
	 */
	private int offset;

	/*
	 * holds number of levels to move up the parent chain from 'nodeId' before rendering, or zero to
	 * render at nodeId itself
	 */
	private int upLevel;
	private boolean renderParentIfLeaf;

	private boolean goToLastPage;

	private boolean forceIPFSRefresh;

	public String getNodeId() {
		return nodeId;
	}

	public boolean isForceIPFSRefresh() {
		return forceIPFSRefresh;
	}

	public void setForceIPFSRefresh(boolean forceIPFSRefresh) {
		this.forceIPFSRefresh = forceIPFSRefresh;
	}

	public void setNodeId(String nodeId) {
		this.nodeId = nodeId;
	}

	public int getUpLevel() {
		return upLevel;
	}

	public void setUpLevel(int upLevel) {
		this.upLevel = upLevel;
	}

	@JsonProperty(required = false)
	public boolean isRenderParentIfLeaf() {
		return renderParentIfLeaf;
	}

	public void setRenderParentIfLeaf(boolean renderParentIfLeaf) {
		this.renderParentIfLeaf = renderParentIfLeaf;
	}

	public int getOffset() {
		return offset;
	}

	public void setOffset(int offset) {
		this.offset = offset;
	}

	public boolean isGoToLastPage() {
		return goToLastPage;
	}

	public void setGoToLastPage(boolean goToLastPage) {
		this.goToLastPage = goToLastPage;
	}
}
