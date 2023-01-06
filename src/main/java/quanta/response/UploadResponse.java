package quanta.response;

import java.util.List;
import quanta.response.base.ResponseBase;

public class UploadResponse extends ResponseBase {
	private List<String> payloads;

	public List<String> getPayloads() {
		return payloads;
	}

	public void setPayloads(List<String> payloads) {
		this.payloads = payloads;
	}
}
