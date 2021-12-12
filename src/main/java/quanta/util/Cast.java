package quanta.util;

import java.util.LinkedHashMap;

/**
 * We encapsulate our unchecked casting needs to this method so the rest of the code
 * is clean because using @SuppressedWarnings on individual lines of code is
 * verbose, ugly, and very inconvenient but encapsulating it here is as clean as
 * Java can be, because unchecked casts from time to time are unavoidable in
 * Java
 */
public class Cast {
	/* Convert to hashmap of String to Object */
	@SuppressWarnings("unchecked")
	public static LinkedHashMap<String, Object> toLinkedHashMap(Object obj) {
		return (LinkedHashMap<String, Object>) obj;
	}
}
