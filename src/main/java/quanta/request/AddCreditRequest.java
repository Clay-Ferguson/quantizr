
package quanta.request;

import java.math.BigDecimal;
import quanta.request.base.RequestBase;

public class AddCreditRequest extends RequestBase {
	private BigDecimal amount;
	private String userId;

	public String getUserId() {
		return userId;
	}

	public void setUserId(String userId) {
		this.userId = userId;
	}

	public BigDecimal getAmount() {
		return amount;
	}

	public void setAmount(BigDecimal amount) {
		this.amount = amount;
	}
}
