package org.subnode.model;

/**
 * Holds the value of a single property (i.e. a property 'value' on a Node)
 */
public class PropertyInfo {
	private String name;
	private Object value;

	public PropertyInfo() {
	}

	public PropertyInfo(String name, Object value) {
		this.name = name;
		this.value = value;
	}

	public Object getValue() {
		return value;
	}

	public void setValue(Object value) {
		this.value = value;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
}
