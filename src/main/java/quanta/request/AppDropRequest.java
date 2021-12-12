package quanta.request;

import quanta.request.base.RequestBase;

public class AppDropRequest extends RequestBase {
	private String data;

	public String getData() {
		return data;
	}

	public void setData(String data) {
		this.data = data;
	}
}
