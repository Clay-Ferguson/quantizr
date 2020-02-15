package org.subnode.config;

/**
 * Node Property Names (constants), node names, types...
 */
public class NodeProp {

	/*
	 * this is the one entered by the admin which DEFINES the feed, and is not to be
	 * overwritten ever by the code
	 */
	public static final String RSS_FEED_SRC = "sn:rssFeedSrc";

	public static final String USER_PREF_PUBLIC_KEY = "sn:publicKey";
	public static final String USER_PREF_EDIT_MODE = "sn:editMode";
	public static final String USER_PREF_SHOW_METADATA = "sn:showMetaData";
	public static final String USER_PREF_IMPORT_ALLOWED = "sn:importAllowed";
	public static final String USER_PREF_EXPORT_ALLOWED = "sn:exportAllowed";
	public static final String USER_PREF_PASSWORD_RESET_AUTHCODE = "sn:pwdResetAuth";
	public static final String SIGNUP_PENDING = "sn:signupPending";

	public static final String EMAIL_CONTENT = "sn:content";
	public static final String EMAIL_RECIP = "sn:recip";
	public static final String EMAIL_SUBJECT = "sn:subject";

	//replicating a copy of this to here for now.
	public static final String ENC_KEY = "sn:encKey";

	/*
	 * WARNING: Only the User Account Root nodes have this property of the actual
	 * user name. All other nodes reference their OWNER as an OwnerId that points to
	 * these nodes.
	 */
	public static final String USER = "sn:user";
	public static final String PWD_HASH = "sn:pwdHash";

	// this pre-existed when i created FS_FILENAME (may be unused?)
	public static final String FILENAME = "sn:fileName";
	public static final String NAME = "sn:name";

	public static final String JSON_FILE_SEARCH_RESULT = "sn:jsonFileSearchResult";

	/*
	 * property used to indicate we should not query the IPFS network again for this
	 * conten becasue we have already loaded it
	 */
	public static final String IPFS_OK = "ipfs:ok";

	/*
	 * mime type expressed as a file extension. Invented so we can set 'txt' v.s.
	 * 'md' to turn off metadata rendering
	 */
	public static final String MIME_EXT = "sn:ext";

	public static final String PASSWORD = "sn:pwd";
	public static final String EMAIL = "sn:email";
	public static final String CODE = "sn:code";

	public static final String BIN_VER = "sn:binVer";

	public static final String BIN_MIME = "sn:mimeType";
	public static final String BIN_FILENAME = "sn:fileName";
	public static final String BIN_SIZE = "sn:size";

	public static final String IMG_WIDTH = "sn:imgWidth";
	public static final String IMG_HEIGHT = "sn:imgHeight";
}
