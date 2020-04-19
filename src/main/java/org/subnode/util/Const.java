package org.subnode.util;

public class Const {
	public static final int ONE_MB = 1024 * 1024;

	public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;

	public static final String IPFS_GATEWAY = "https://gateway.temporal.cloud/ipfs/";

	/* todo-0: The value for this is also in the MongoSession, and needs to be passed back to client as part of login. I infact
	need all user settings sent to client on login right? */
	public static final int DEFAULT_MAX_FILE_SIZE = 20 * ONE_MB;

	public static final String FAKE_USER_AGENT = "Mozilla/5.0";
}