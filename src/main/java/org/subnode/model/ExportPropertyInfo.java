package org.subnode.model;

/**
 * Model object used in export process
 */
public class ExportPropertyInfo {
	private String name;
	private String type;
	private Object val;
	
	public Object getVal() {
		return val;
	}

	public void setVal(Object val) {
		this.val = val;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}
}
