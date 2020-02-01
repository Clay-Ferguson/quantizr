package org.subnode.service;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.subnode.mongo.model.SubNode;

/**
 * Utility to read JSON and store into SubNode automatically.
 */
@Component
public class JsonToSubNodeService {
	private static final Logger log = LoggerFactory.getLogger(JsonToSubNodeService.class);
	private static final ObjectMapper jsonMapper = new ObjectMapper();

	public void importJsonContent(String json, SubNode parentNode) {
		try {
			HashMap<String, ?> map = jsonMapper.readValue(json, HashMap.class);
			setPropsFromMap(map, parentNode);
		} catch (Exception e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	public void setProp(SubNode node, String propName, Object propVal) {
		if (propName == null || propVal == null)
			return;

		if (propVal instanceof String) {
			node.setProp(propName, (String) propVal);
		} else if (propVal instanceof Date) {
			node.setProp(propName, (Date) propVal);
		} else if (propVal instanceof Integer) {
			node.setProp(propName, (Integer) propVal);
		} else if (propVal instanceof Long) {
			node.setProp(propName, (Long) propVal);
		}
		// todo-1: put in rest of types.
		else {
			throw new RuntimeException(
					"Type not yet handled: " + propVal.getClass().getName() + " propName: " + propName);
		}
	}

	/* There will be a better map-lookup implementation for this eventually */
	public void setPropsFromMap(HashMap<String, ?> map, SubNode node) {
		String type = (String) map.get("type");
		if (type != null) {
			node.setType(type);
		}

		String content = (String) map.get("cont");
		if (content != null) {
			node.setContent(content);
		} 

		Long ordinal = (Long) map.get("ordinal");
		if (ordinal != null) {
			node.setOrdinal(ordinal);
		}

		Object props = map.get("props");
		if (props instanceof ArrayList<?>) {
			for (Object elm : (ArrayList<?>) props) {
				if (elm instanceof LinkedHashMap) {
					LinkedHashMap<String, String> lhm = (LinkedHashMap<String, String>) elm;
					setProp(node, lhm.get("name"), lhm.get("val"));
				}
			}
		}
	}
}

