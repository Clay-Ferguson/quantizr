package org.subnode.mongo.model;


public class SubNodeTypes {
	public static final String UNSTRUCTURED = "u";
	public static final String BASH_SCRIPT = "bash";
	public static final String TYPE_RSS_FEED = "sn:rssfeed";
	public static final String TYPE_RSS_ITEM = "sn:rssitem";
	public static final String TYPE_PASSWORD = "sn:passwordType";

	// /* =================================================================== */
	// public static final String FS_SYNC_ROOT = "fs.root";
	// /**
	//  * Required subproperties
	//  * <pre>
	//  * sn:folderSync -> changing to fs:link: Full filesystem path (of a folder) on server that the node is synced to (including all subfolders, recursively)
	//  */

	// /* =================================================================== */
	// public static final String FS_FOLDER = "fs:folder";
	// /**
	//  * Required subproperties
	//  * <pre>
	//  * fs:link: Full filesystem path (of a folder) on server that the node is synced to. 
	//  */

	//  /* =================================================================== */
	// public static final String FS_FILE = "fs:file";
	// /**
	//  * Required subproperties
	//  * <pre>
	//  * fs:link: Full filesystem path (of a file) on server that the node is synced to. 
	//  */
}
