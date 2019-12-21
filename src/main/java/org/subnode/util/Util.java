package org.subnode.util;

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

	public static ClientHttpRequestFactory getClientHttpRequestFactory() {
		int timeout = 5000;
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
