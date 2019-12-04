package org.subnode.response;

import org.subnode.model.PropertyInfo;
import org.subnode.response.base.ResponseBase;

public class SavePropertyResponse extends ResponseBase {
	private PropertyInfo propertySaved;

	public PropertyInfo getPropertySaved() {
		return propertySaved;
	}

	public void setPropertySaved(PropertyInfo propertySaved) {
		this.propertySaved = propertySaved;
	}
}
