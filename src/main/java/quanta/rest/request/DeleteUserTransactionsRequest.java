
package quanta.rest.request;

import quanta.rest.request.base.RequestBase;

public class DeleteUserTransactionsRequest extends RequestBase {
	private String userId;

	public String getUserId() {
		return userId;
	}

	public void setUserId(String userId) {
		this.userId = userId;
	}
}
