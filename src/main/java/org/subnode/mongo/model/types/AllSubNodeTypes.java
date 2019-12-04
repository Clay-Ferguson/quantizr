package org.subnode.mongo.model.types;

import org.subnode.mongo.model.types.properties.FileSyncIPFSLink;
import org.subnode.mongo.model.types.properties.FileSyncIPFSLinkName;
import org.subnode.mongo.model.types.properties.FileSyncLink;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * This class is just a wrapper to make it easier to inject types into any other component.
 */
@Component
public class AllSubNodeTypes {
	@Autowired
	public FileSyncFolder FS_FOLDER;

	@Autowired
	public FileSyncFile FS_FILE;

	@Autowired
	public FileSyncLink FS_LINK;

	@Autowired
	public FileSyncIPFSNode IPFS_NODE;

	@Autowired
	public FileSyncIPFSLink IPFS_LINK;

	@Autowired
	public FileSyncIPFSLinkName IPFS_LINK_NAME;
}