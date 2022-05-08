package quanta.request;

import quanta.request.base.RequestBase;

public class LikeNodeRequest extends RequestBase {
	private String id;
	private boolean like;

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public boolean isLike() {
		return like;
	}

	public void setLike(boolean like) {
		this.like = like;
	}
}
