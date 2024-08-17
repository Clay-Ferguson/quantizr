
package quanta.rest.response;

import java.math.BigDecimal;

public class UpdateAccountInfo extends ServerPushInfo {
	private String nodeId;
	private BigDecimal credit;

	public UpdateAccountInfo(String nodeId, BigDecimal credit) {
		super("accountInfo");
		this.nodeId = nodeId;
		this.credit = credit;
	}

	public String getNodeId() {
		return this.nodeId;
	}

	public void setNodeId(final String nodeId) {
		this.nodeId = nodeId;
	}

	public BigDecimal getCredit() {
		return credit;
	}

	public void setCredit(BigDecimal credit) {
		this.credit = credit;
	}

	public UpdateAccountInfo() {}
}
