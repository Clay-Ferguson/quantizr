package org.subnode.util;

import java.io.InputStream;
import java.util.Scanner;

import javax.servlet.http.HttpServletRequest;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;

public class Util {
	private static final Logger log = LoggerFactory.getLogger(Util.class);

	public static void sleep(long millis) {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}

	/*
	 * If addParam is non null it's expected to be something like "param=val" and
	 * will get added to any existing query string
	 */
	public static String getFullURL(HttpServletRequest request, String addParam) {
		String url = request.getRequestURL().toString();
		String query = request.getQueryString();

		// append to queryString if necessary.
		if (!StringUtils.isEmpty(addParam)) {
			if (!StringUtils.isEmpty(query)) {
				query += "&" + addParam;
			} else {
				query = "&" + addParam;
			}
		}

		if (query == null) {
			return url;
		} else {
			return url + "?" + query;
		}
	}

	// extracts mime from this type of url: data:image/png;base64,[data...]
	public static String getMimeFromDataUrl(String url) {
		int colonIdx = url.indexOf(":");
		int semiColonIdx = url.indexOf(";");
		String mime = url.substring(colonIdx + 1, semiColonIdx);
		return mime;
	}

	/**
	 * Returns only 'chars' characters of the hash, or the entire sha256 if chars
	 * is -1
	 */
	public static String getHashOfString(String val, int chars) {
		String pathHash = DigestUtils.sha256Hex(val.getBytes());
		// todo-0: this algo for chars!=-1 assumes the first 'chars' of a sha256 are random enough
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
	// int timeout = 5000;
	// RequestConfig config = RequestConfig.custom()
	// .setConnectTimeout(timeout)
	// .setConnectionRequestTimeout(timeout)
	// .setSocketTimeout(timeout)
	// .build();
	// CloseableHttpClient client = HttpClientBuilder
	// .create()
	// .setDefaultRequestConfig(config)
	// .build();
	// return new HttpComponentsClientHttpRequestFactory(client);
	// }

	public static String extractTitleFromUrl(String url) {
		String title = null;
		InputStream is = null;
		Scanner scanner = null;

		long startTime = System.currentTimeMillis();
		try {
			int timeout = 20;
			RequestConfig config = RequestConfig.custom()//
					.setConnectTimeout(timeout * 1000) //
					.setConnectionRequestTimeout(timeout * 1000) //
					.setSocketTimeout(timeout * 1000).build();
			HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
			HttpGet request = new HttpGet(url);
			request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
			HttpResponse response = client.execute(request);

			log.debug("Response Code: " + response.getStatusLine().getStatusCode() + " reason="
					+ response.getStatusLine().getReasonPhrase());

			scanner = new Scanner(response.getEntity().getContent());
			String responseBody = scanner.useDelimiter("\\A").next();
			title = responseBody.substring(responseBody.indexOf("<title>") + 7, responseBody.indexOf("</title>"));
		} catch (Exception e) {
			log.error("*** ERROR reading url: " + url, e);
			return null;
		} finally {
			StreamUtil.close(scanner, is);
			log.info("Stream read took: " + (System.currentTimeMillis() - startTime) + "ms");
		}

		return title;

		// InputStream response = null;
		// try {
		// String url = "http://www.google.com";
		// response = new URL(url).openStream();

		// Scanner scanner = new Scanner(response);
		// String responseBody = scanner.useDelimiter("\\A").next();
		// System.out.println(
		// responseBody.substring(responseBody.indexOf("<title>") + 7,
		// responseBody.indexOf("</title>")));

		// } catch (IOException ex) {
		// ex.printStackTrace();
		// } finally {
		// try {
		// response.close();
		// } catch (IOException ex) {
		// ex.printStackTrace();
		// }
		// }
	}

}
