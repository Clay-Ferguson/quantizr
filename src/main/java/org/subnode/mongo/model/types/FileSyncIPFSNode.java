package org.subnode.mongo.model.types;

import org.subnode.mongo.model.types.intf.SubNodeType;
import org.subnode.mongo.model.types.properties.FileSyncIPFSLink;

import org.springframework.stereotype.Component;

@Component
public class FileSyncIPFSNode implements SubNodeType {
    public static FileSyncIPFSLink LINK = new FileSyncIPFSLink();

    public String getName() {
        return "ipfs:node";
    }
}