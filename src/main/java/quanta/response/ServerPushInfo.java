package quanta.response;

import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;

public class ServerPushInfo {

	/**
	 * Examples: type=='newNode' nodeId=[id of the node]
	 */
	@Transient
	@JsonIgnore
	private String type;

	//WARNING: parameterless constructor required for marshalling.
	public ServerPushInfo() {
	}

	public ServerPushInfo(String type) {
		this.type = type;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}
}
