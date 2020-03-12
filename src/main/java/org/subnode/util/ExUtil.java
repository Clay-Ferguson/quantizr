package org.subnode.util;

import java.io.InputStream;
import java.util.Scanner;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * SubNode uses RuntimeExceptions primarily for all exception handling, throughout the app because
 * of the cleanness of the API when it doesn't have to declare checked exceptions everywhere, and
 * this utility encapsulates the convertion of most checked exceptions to RuntimeExceptions.
 * 
 * Note: This code doesn't ignore exceptions or alter our ability to properly handle ALL exceptions
 * of both types, but it just makes the code cleaner, by doing what he Java-language SHOULD have
 * done to begin with.
 */
public class ExUtil {
	private static final Logger log = LoggerFactory.getLogger(ExUtil.class);
	private static final String FAKE_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)Chrome/53.0.2785.143Safari/537.36";

	public static RuntimeEx newEx(Throwable ex) {

		// removing logging, because some exception throwing is intentional (not error)
		// log.error("logAndRethrow", ex);
		if (ex instanceof RuntimeEx) {
			return (RuntimeEx) ex;
		}
		return new RuntimeEx(ex);
	}

	public static RuntimeEx newEx(String msg) {
		RuntimeEx ex = new RuntimeEx(msg);
		// removing logging, because some exception throwing is intentional (not error)
		// log.error("logThrow", ex);
		return ex;
	}

	public static void debug(Logger logger, String msg, Throwable e) {
		logger.debug(msg, e);

		/* Not showing all sub-causes in the chain, but just the immediate one */
		if (e.getCause() != null) {
			logger.debug("cause:", e);
		}
	}

	public static void error(Logger logger, String msg, Throwable e) {
		logger.error(msg, e);

		/* Not showing all sub-causes in the chain, but just the immediate one */
		if (e.getCause() != null) {
			logger.error("cause:", e);
		}
	}

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
			request.addHeader("User-Agent", FAKE_USER_AGENT);
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
		// 	String url = "http://www.google.com";
		// 	response = new URL(url).openStream();

		// 	Scanner scanner = new Scanner(response);
		// 	String responseBody = scanner.useDelimiter("\\A").next();
		// 	System.out.println(
		// 			responseBody.substring(responseBody.indexOf("<title>") + 7, responseBody.indexOf("</title>")));

		// } catch (IOException ex) {
		// 	ex.printStackTrace();
		// } finally {
		// 	try {
		// 		response.close();
		// 	} catch (IOException ex) {
		// 		ex.printStackTrace();
		// 	}
		// }
	}
}
