package org.subnode.mongo.model.types;

import org.subnode.mongo.model.types.intf.SubNodeType;
import org.subnode.mongo.model.types.properties.FileSyncLink;

import org.springframework.stereotype.Component;

@Component
public class FileSyncFile implements SubNodeType {
    public static FileSyncLink LINK = new FileSyncLink();

    public String getName() {
        return "fs:file";
    }
}