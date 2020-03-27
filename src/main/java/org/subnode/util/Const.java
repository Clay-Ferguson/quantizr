package org.subnode.util;

public class Const {
	public static final int ONE_MB = 1024 * 1024;

	public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;

	public static final String FAKE_USER_AGENT = "Mozilla/5.0";

	/**
	 * This is experimental flag to upload into "Temporal Cloud" IPFS Pinning
	 * service to let them host the files for us! When this flag is false it resorts
	 * to storing data into our own server's IPFS cache.
	 * 
	 * After this server code for uploding to Temporal was attempted I realized it's
	 * better to just upload straigt from browser to Temporal, and simply never have
	 * the data routed thru Quantizr server at all.
	 */
	public static final boolean saveToTemporal = false;
}