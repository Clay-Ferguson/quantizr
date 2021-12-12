package quanta.types;

import java.util.HashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class TypePluginMgr {
    private static final Logger log = LoggerFactory.getLogger(TypePluginMgr.class);
    private static HashMap<String, TypeBase> types = new HashMap<>();

    public static void addType(TypeBase type) {
        log.debug("Plugin: "+type.getClass().getName());
        types.put(type.getName().toLowerCase(), type);
    }

    public HashMap<String, TypeBase> getTypes() {
        return types;
    }

    public TypeBase getPluginByType(String type) {
        return types.get(type.toLowerCase());
    }
}
