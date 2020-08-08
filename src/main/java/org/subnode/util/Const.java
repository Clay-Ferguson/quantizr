package org.subnode.util;

public class Const {
	public static final int ONE_MB = 1024 * 1024;

	public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;

	//note: temporal has been down a lot lately, but we were done using them anyway....
	public static final String IPFS_GATEWAY = "https://gateway.temporal.cloud/ipfs/";

	//so this is the new gateway (only used for building URLs to let them support some bandwidth)
	public static final String IPFS_IO_GATEWAY = "https://gateway.ipfs.io/ipfs/";

	public static final String FAKE_USER_AGENT = "Mozilla/5.0";
}