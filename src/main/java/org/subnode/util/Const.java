package org.subnode.util;

public class Const {
	public static final int ONE_MB = 1024 * 1024;

	public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;

	public static final String IPFS_GATEWAY = "https://gateway.temporal.cloud/ipfs/";

	/*
	 * todo-0: need to make this a per-user setting (not the default that this is
	 * but the operative value), and add to the nodes the user isn't allowed to edit.
	 * 
	 * see: BIN_MAX_UPLOAD_SIZE
	 * NOTE: This must match Constants.MAX_UPLOAD_MB in TypeScript file.
	 */
	public static final int DEFAULT_MAX_FILE_SIZE = 20 * ONE_MB;

	public static final String FAKE_USER_AGENT = "Mozilla/5.0";
}