package org.subnode.mongo.model.types.properties;

import org.subnode.mongo.model.types.intf.SubNodeProperty;

import org.springframework.stereotype.Component;

@Component
public class FileSyncLink implements SubNodeProperty {

    public String getName() {
        return "fs:link";
    }

    public String getType() {
        return "s";
    }
}