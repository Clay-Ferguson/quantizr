package org.subnode.util;

public class Const {
    public static final int ONE_MB = 1024*1024;

    public static final int DEFAULT_USER_QUOTA = 10 * ONE_MB;

    /**
	 * This is experimental flag to upload into "Temporal Cloud" IPFS Pinning
	 * service to let them host the files for us! When this flag is false it resorts
	 * to storing data into our own server's IPFS cache.
	 */
	public static final boolean saveToTemporal = false;
}