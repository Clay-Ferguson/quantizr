package org.subnode.model;

/**
 * Holds the value of a single property (i.e. a 'value' on a Node)
 */
public class PropertyInfo {
	private String name;

	/*
	 * Only one of these will be non-null. The property is either multi-valued or single valued
	 * 
	 * Also the 'value' is the actual text stored in the DB, and is assumed to be markdown for
	 * content nodes.
	 */
	private String value;

	public PropertyInfo() {
	}

	public PropertyInfo(String name, String value) {
		this.name = name;
		this.value = value;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
