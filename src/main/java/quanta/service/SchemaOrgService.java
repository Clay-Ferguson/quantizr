package quanta.service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.config.ServiceBase;
import quanta.util.StreamUtil;
import quanta.util.XString;

@Component
public class SchemaOrgService extends ServiceBase {
	/*
	 * For the PoC experimental code, we'll just hold the schema info in the actual maps we got from a
	 * generic map parse via faster jackson.
	 */
	class SchemaClass {
		LinkedHashMap<String, Object> clazz;
		List<LinkedHashMap<String, Object>> properties = new LinkedList<>();
	}

	private static final Logger log = LoggerFactory.getLogger(SchemaOrgService.class);

	public static final ObjectMapper mapper = new ObjectMapper();
	public static HashMap<String, Object> schema = null;

	/*
	 * We'll keep properties and classes separate rather than doing any containment, because we can
	 * always afford to do a brute force thru all properties whenever we need to find the properties in
	 * a given class.
	 */
	public static final LinkedHashMap<String, SchemaClass> classes = new LinkedHashMap<>();

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		ServiceBase.init(event.getApplicationContext());
		loadJson("classpath:public/schemaorg/schemaorg-all-https.jsonld");
	}

	public void loadJson(String fileName) {
		try {
			Resource resource = context.getResource(fileName);
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));
			try {
				schema = mapper.readValue(is, new TypeReference<HashMap<String, Object>>() {});
				if (schema == null) {
					log.debug("schema.org data failed to load.");
					schema = new HashMap<>();
				} else {
					// log.debug("SCHEMA.ORG: " + XString.prettyPrint(schema));
					parseSchema();

					// prove the parsing works by printing Person object properties.
					// SchemaClass person = classes.get("schema:Person");
					// if (person != null) {
					// 	log.debug("PERSON PROPS=" + XString.prettyPrint(person.properties));
					// }
				}
			} finally {
				StreamUtil.close(in);
			}

		} catch (Exception ex) {
			// log and ignore.
			log.error("Failed to load " + fileName, ex);
		}
	}

	private void parseSchema() {
		List graph = (List) schema.get("@graph"); // will be ArrayList<Object>
		if (graph == null)
			return;

		// first scan graph to build classes
		log.debug("Scanning Schema.org Classes.");
		for (Object item : graph) {
			Object id = null;
			if (item instanceof LinkedHashMap) {
				Object type = ((LinkedHashMap) item).get("@type");
				if (type instanceof String) {
					switch ((String) type) {
						case "rdfs:Class":
							id = ((LinkedHashMap) item).get("@id");
							if (id instanceof String) {
								// log.debug("TypeID: " + (String) id);
								SchemaClass clazz = new SchemaClass();
								clazz.clazz = (LinkedHashMap) item;
								classes.put((String) id, clazz);
							}
							break;
						default:
							break;
					}
				} else {
					log.debug("unknown type: " + XString.prettyPrint(item));
				}
			}
		}

		log.debug("Scanning Schema.org Properties.");
		// next we scan again to distribute the properties into all the classes
		for (Object item : graph) {
			if (item instanceof LinkedHashMap) {
				Object type = ((LinkedHashMap) item).get("@type");
				if (type instanceof String) {
					switch ((String) type) {
						case "rdf:Property":
							setupProperty((LinkedHashMap) item);
						default:
							break;
					}
				} else {
					log.debug("unknown type: " + XString.prettyPrint(item));
				}
			}
		}
	}

	private void setupProperty(LinkedHashMap item) {
		// Object id = ((LinkedHashMap) item).get("@id");
		// if (id instanceof String) {
		// 	log.debug("Property: " + (String) id);
		// }

		Object domains = item.get("schema:domainIncludes");
		if (domains instanceof List) {
			for (Object domain : (List) domains) {
				if (domain instanceof LinkedHashMap) {
					Object domainId = ((LinkedHashMap) domain).get("@id");
					if (domainId instanceof String) {
						// log.debug("    DOMAIN: " + domainId);
						SchemaClass clazz = classes.get((String) domainId);
						if (clazz != null) {
							clazz.properties.add(item);
						}
					}
				}
			}
		}

		// Now that classes are updated we don't need domains to even residen in memory, so blow it away.
		item.remove("schema:domainIncludes");

		// and these now have no value either, so remove from memory
		item.remove("@type");
		item.remove("schema:source");
	}
}
