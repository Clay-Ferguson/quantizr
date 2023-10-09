
package quanta.request;

import quanta.request.base.RequestBase;

public class DeleteUserTransactionsRequest extends RequestBase {
	private String userId;

	public String getUserId() {
		return userId;
	}

	public void setUserId(String userId) {
		this.userId = userId;
	}
}
