package quanta.service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
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
import quanta.model.client.SchemaOrgClass;
import quanta.model.client.SchemaOrgProp;
import quanta.response.GetSchemaOrgTypesResponse;
import quanta.util.StreamUtil;
import quanta.util.XString;

@Component
public class SchemaOrgService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(SchemaOrgService.class);

	public static final ObjectMapper mapper = new ObjectMapper();
	public static HashMap<String, Object> schema = null;

	/*
	 * We'll keep properties and classes separate rather than doing any containment, because we can
	 * always afford to do a brute force thru all properties whenever we need to find the properties in
	 * a given class.
	 */
	public static final HashMap<String, SchemaOrgClass> classMap = new HashMap<>();
	public static final ArrayList<SchemaOrgClass> classList = new ArrayList<>();

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
			if (item instanceof HashMap) {
				HashMap mitem = (HashMap) item;
				Object type = mitem.get("@type");
				if (type instanceof String) {
					switch ((String) type) {
						case "rdfs:Class":
							Object id = mitem.get("@id");
							if (id instanceof String) {
								String sid = (String) id;
								// log.debug("TypeID: " + sid);
								SchemaOrgClass soc = new SchemaOrgClass();
								Object label = mitem.get("rdfs:label");
								String slabel = getStringValue(label);

								if (slabel == null) {
									throw new RuntimeException("label not available: " + XString.prettyPrint(mitem));
								}

								soc.setLabel(slabel);
								soc.setId(sid);
								classMap.put(sid, soc);
								classList.add(soc);
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
			if (item instanceof HashMap) {
				HashMap mitem = (HashMap) item;
				Object type = mitem.get("@type");
				if (type instanceof String) {
					String stype = (String) type;
					switch (stype) {
						case "rdf:Property":
							// log.debug("Property: " + stype);
							setupProperty(mitem);
						default:
							break;
					}
				} else {
					log.debug("unknown type: " + XString.prettyPrint(item));
				}
			}
		}

		classList.sort((n1, n2) -> (int) n1.getLabel().compareTo(n2.getLabel()));

		for (SchemaOrgClass soc : classList) {
			// to simplify and save space we can remove "schema:" prefix from all IDs
			soc.setId(soc.getId().replace("schema:", ""));

			// sort properties
			soc.getProps().sort((n1, n2) -> (int) n1.getLabel().compareTo(n2.getLabel()));
		}
	}

	private String getStringValue(Object label) {
		String slabel = null;
		// handle if string
		if (label instanceof String) {
			slabel = (String) label;
		}
		// else try to get @value out of object
		else if (label instanceof HashMap) {
			HashMap mlabel = (HashMap) label;
			Object val = mlabel.get("@value");
			if (val instanceof String) {
				slabel = (String) val;
			}
		}
		return slabel;
	}

	private void setupProperty(HashMap item) {
		Object domains = item.get("schema:domainIncludes");
		// handle if object
		if (domains instanceof HashMap) {
			setupDomainObj(item, domains);
		}
		// handle of list
		else if (domains instanceof List) {
			List ldomains = (List) domains;
			for (Object domain : ldomains) {
				if (domain instanceof HashMap) {
					setupDomainObj(item, domain);
				}
			}
		}
		// else warning
		else {
			log.debug("unable to get domainIncludes from " + XString.prettyPrint(item));
		}

		// Now that classes are updated we don't need domains to even residen in memory, so blow it away.
		item.remove("schema:domainIncludes");

		// and these now have no value either, so remove from memory
		item.remove("@type");
		item.remove("schema:source");
	}

	private void setupDomainObj(HashMap item, Object domain) {
		HashMap mdomain = (HashMap) domain;
		Object domainId = mdomain.get("@id");
		if (domainId instanceof String) {
			String sdomainId = (String) domainId;
			// log.debug(" DOMAIN: " + domainId);
			SchemaOrgClass soc = classMap.get(sdomainId);
			if (soc != null) {
				SchemaOrgProp prop = new SchemaOrgProp();
				Object propLabel = item.get("rdfs:label");
				String slabel = getStringValue(propLabel);

				if (slabel != null) {
					prop.setLabel(slabel);
					soc.getProps().add(prop);
				} else {
					throw new RuntimeException("Unable to parse 'rdfs:label' from " + XString.prettyPrint(item));
				}
			}
		}
	}

	public GetSchemaOrgTypesResponse getSchemaOrgTypes() {
		GetSchemaOrgTypesResponse res = new GetSchemaOrgTypesResponse();
		res.setClasses(classList);
		return res;
	}
}
