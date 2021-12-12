package quanta.util;

import java.io.InputStream;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.Locale;
import java.util.Random;
import java.util.Scanner;
import javax.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

public class Util {
	private static final Logger log = LoggerFactory.getLogger(Util.class);
	private static final Random rand = new Random();

	public static boolean no(Object o) {
		return o == null;
	}

	public static boolean ok(Object o) {
		return o != null;
	}

	public static void sleep(long millis) {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}

	/*
	 * I found this code online and it is not fully tested, but according to my research it is the best
	 * way you can try determining the source IP.
	 */
	public static String getClientIpAddr(HttpServletRequest request) {
		String ip = request.getHeader("X-Forwarded-For");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("Proxy-Client-IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("WL-Proxy-Client-IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("HTTP_CLIENT_IP");
		if (!unknownIp(ip))
			return ip;

		ip = request.getHeader("HTTP_X_FORWARDED_FOR");
		if (!unknownIp(ip))
			return ip;

		ip = request.getRemoteAddr();
		if (!unknownIp(ip))
			return ip;

		return "unknown";
	}

	public static boolean unknownIp(String ip) {
		return no(ip) || ip.length() == 0 || "unknown".equalsIgnoreCase(ip);
	}

	public static boolean isSpringAuthenticated() {
		return ok(SecurityContextHolder.getContext().getAuthentication())
				&& SecurityContextHolder.getContext().getAuthentication().isAuthenticated();

		// DO NOT DELETE (yet)
		// //when Anonymous Authentication is enabled
		// !(SecurityContextHolder.getContext().getAuthentication()
		// instanceof AnonymousAuthenticationToken)
	}

	/*
	 * Generates a very strong unguessable token. We could also use JWT here, but for our architecture
	 * the only requirement is unique and unguessable.
	 */
	public static String genStrongToken() {
		// Warning: SimpleDateFormat is not threadsafe. Always create here.
		SimpleDateFormat dateFormat = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
		String str = dateFormat.format(new Date()) + "-" + String.valueOf(Math.abs(rand.nextLong()));
		try {
			return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(str.getBytes()));
		} catch (Exception e) {
			throw new RuntimeException("SHA-256 failed");
		}
	}

	public static boolean equalObjs(Object o1, Object o2) {
		if (no(o1) && no(o2))
			return true;
		if (ok(o1) && no(o2))
			return false;
		if (ok(o2) && no(o1))
			return false;
		return o1.equals(o2);
	}

	/*
	 * If addParam is non null it's expected to be something like "param=val" and will get added to any
	 * existing query string
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

		if (no(query)) {
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

	// timeout=0 means infinite timeout (no timeout)
	public static ClientHttpRequestFactory getClientHttpRequestFactory(int timeout) {
		HttpComponentsClientHttpRequestFactory clientHttpRequestFactory = new HttpComponentsClientHttpRequestFactory();
		clientHttpRequestFactory.setConnectionRequestTimeout(timeout);
		clientHttpRequestFactory.setConnectTimeout(timeout);
		clientHttpRequestFactory.setReadTimeout(timeout);
		return clientHttpRequestFactory;
	}

	public static HttpEntity<MultiValueMap<String, Object>> getBasicRequestEntity() {
		HttpHeaders headers = new HttpHeaders();
		MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
		HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
		return requestEntity;
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
