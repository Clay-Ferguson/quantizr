package org.subnode.util;

import java.util.Comparator;

import org.subnode.model.PropertyInfo;

/**
 * Simple name property comparator.
 *
 */
class PropertyInfoComparator implements Comparator<PropertyInfo> {
	public int compare(PropertyInfo a, PropertyInfo b) {
		return a.getName().compareTo(b.getName());
	}
}