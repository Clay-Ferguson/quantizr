package org.subnode.user;

import java.util.HashMap;

/**
 * Models a cache of currently-unsaved user settings waiting to be saved. (todo-1: am I still using
 * this?)
 */
public class UnsavedUserSettings {
	private HashMap<String, Object> map = new HashMap<String, Object>();

	public HashMap<String, Object> getMap() {
		return map;
	}
}
