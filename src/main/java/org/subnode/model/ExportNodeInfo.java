package org.subnode.model;


import java.util.List;

/**
 * Model object for export process
 */
public class ExportNodeInfo {
	private String id;
	private String type;
	private String cont;
	private String path;
	private Long ordinal;

	private List<ExportPropertyInfo> props;

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getCont() {
		return cont;
	}

	public void setCont(String cont) {
		this.cont = cont;
	}

	public List<ExportPropertyInfo> getProps() {
		return props;
	}

	public void setProps(List<ExportPropertyInfo> props) {
		this.props = props;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	public Long getOrdinal() {
		return ordinal;
	}

	public void setOrdinal(Long ordinal) {
		this.ordinal = ordinal;
	}
}
