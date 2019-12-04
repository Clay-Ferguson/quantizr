package org.subnode.mongo.model;

import java.util.Date;

public class SubNodePropVal {
	private Object value;

	public SubNodePropVal() {
	}

	public SubNodePropVal(Long val) {
		value = val;
	}
	
	public SubNodePropVal(Integer val) {
		value = val;
	}

	public SubNodePropVal(String val) {
		value = val;
	}

	public SubNodePropVal(Date val) {
		value = val;
	}

	public SubNodePropVal(Boolean val) {
		value = val;
	}

	public SubNodePropVal(Double val) {
		value = val;
	}

	public Object getValue() {
		return value;
	}

	public void setValue(Object value) {
		this.value = value;
	}
}
