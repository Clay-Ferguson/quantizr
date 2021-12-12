package quanta.request;

import java.util.List;
import quanta.request.base.RequestBase;

public class GetNodeMetaInfoRequest extends RequestBase {
	private List<String> ids;

	public List<String> getIds() {
		return ids;
	}

	public void setIds(List<String> ids) {
		this.ids = ids;
	}
}
