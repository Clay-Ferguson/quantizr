package org.subnode.mongo.model.types;

import org.subnode.mongo.model.types.intf.SubNodeType;
import org.subnode.mongo.model.types.properties.FileSyncLink;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class FileSyncFolder implements SubNodeType { 
    @Autowired
    public FileSyncLink LINK;

    public String getName() {
        return "fs:folder";
    }
}