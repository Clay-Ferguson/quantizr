package org.subnode.config;

/**
 * Node Property Names (constants), node names, types...
 */
public class NodeProp {

	// public static final String RSS_FEED_ROOT_URLS = "rssFeedRootUrls";

	public static final String META6_TYPE_FOLDER = "sn:folder";

	public static final String RSS_FEED_TITLE = "sn:rssFeedTitle";
	public static final String RSS_FEED_DESC = "sn:rssFeedDesc";
	public static final String RSS_FEED_URI = "sn:rssFeedUri";
	public static final String RSS_FEED_LINK = "sn:rssFeedLink";
	public static final String RSS_FEED_IMAGE_URL = "sn:rssFeedImageUrl";

	/*
	 * this is the one entered by the admin which DEFINES the feed, and is not to be
	 * overwritten ever by the code
	 */
	public static final String RSS_FEED_SRC = "sn:rssFeedSrc";

	public static final String RSS_ITEM_TITLE = "sn:rssItemTitle";
	public static final String RSS_ITEM_DESC = "sn:rssItemDesc";
	public static final String RSS_ITEM_URI = "sn:rssItemUri";
	public static final String RSS_ITEM_LINK = "sn:rssItemLink";
	public static final String RSS_ITEM_AUTHOR = "sn:rssItemAuthor";
	public static final String RSS_ITEM_ENC_TYPE = "sn:rssItemEncType";
	public static final String RSS_ITEM_ENC_LENGTH = "sn:rssItemEncLength";
	public static final String RSS_ITEM_ENC_URL = "sn:rssItemEncUrl";

	public static final String MERKLE_HASH = "sn:merkle";

	/*
	 * "true" means any user can add subnode under the node that has this property
	 */
	public static final String PUBLIC_APPEND = "sn:publicAppend";

	/*
	 * comment nodes are always 'admin owned' in terms of the true credentials, but
	 * are flagged as who the comment was actually posted by using the 'commentBy'
	 * property. This way that person can be allowed to edit the content, but have
	 * no other privileges.
	 */
	public static final String COMMENT_BY = "sn:commentBy";

	public static final String USER_PREF_ADV_MODE = "sn:advMode";
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

	/*
	 * WARNING: Only the User Account Root nodes have this property of the actual
	 * user name. All other nodes reference their OWNER as an OwnerId that points to
	 * these nodes.
	 */
	public static final String USER = "sn:user";

	public static final String UUID = "sn:uuid";
	public static final String PRIMARY_TYPE = "sn:primaryType";

	// this pre-existed when i created FS_FILENAME (may be unused?)
	public static final String FILENAME = "sn:fileName";

	public static final String NAME = "sn:name";
	public static final String JSON_FILE_SEARCH_RESULT = "sn:jsonFileSearchResult";
	public static final String DISABLE_INSERT = "sn:disableInsert";

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
