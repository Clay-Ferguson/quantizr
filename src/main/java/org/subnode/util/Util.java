package org.subnode.util;

import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;

public class Util {
	public static void sleep(long millis) {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}

	/**
	 * Returns only 'chars' characters of the hash, or the ebntire sha256 if chars
	 * is -1
	 */
	public static String getHashOfString(String val, int chars) {
		String pathHash = DigestUtils.sha256Hex(val.getBytes());
		return chars == -1 ? pathHash : pathHash.substring(0, chars);
	}

	public static ClientHttpRequestFactory getClientHttpRequestFactory() {
		int timeout = 20000;
		HttpComponentsClientHttpRequestFactory clientHttpRequestFactory = new HttpComponentsClientHttpRequestFactory();
		clientHttpRequestFactory.setConnectTimeout(timeout);
		return clientHttpRequestFactory;
	}

	// //other example from Baeldung
	// private ClientHttpRequestFactory getClientHttpRequestFactory() {
	// 	int timeout = 5000;
	// 	RequestConfig config = RequestConfig.custom()
	// 	  .setConnectTimeout(timeout)
	// 	  .setConnectionRequestTimeout(timeout)
	// 	  .setSocketTimeout(timeout)
	// 	  .build();
	// 	CloseableHttpClient client = HttpClientBuilder
	// 	  .create()
	// 	  .setDefaultRequestConfig(config)
	// 	  .build();
	// 	return new HttpComponentsClientHttpRequestFactory(client);
	// }
}
