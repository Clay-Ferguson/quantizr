package quanta.util;

import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.util.Date;
import java.util.Random;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import quanta.mongo.MongoRepository;
import reactor.core.publisher.Mono;

public class Util {
    private static Logger log = LoggerFactory.getLogger(Util.class);

    private static final Random rand = new Random();

    public static ObjectMapper simpleMapper;
    public static final ObjectMapper mapper;
    public static final ObjectMapper yamlMapper;

    static {
        simpleMapper = new ObjectMapper();
        mapper = new ObjectMapper();
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.setSerializationInclusion(Include.NON_NULL);
        yamlMapper = new ObjectMapper(new YAMLFactory());
    }

    public static String httpCall(WebClient webClient, Object request) {
        String response = null;
        try {
            response = webClient.post() //
                    .body(BodyInserters.fromValue(XString.prettyPrint(request))) //
                    .retrieve() //
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), clientResponse -> {
                        // This will trigger for any response with 4xx or 5xx status codes
                        return clientResponse.bodyToMono(String.class).flatMap(errorBody -> {
                            log.debug("Error response from server: " + errorBody);
                            return Mono.error(new RuntimeException("Error response from server: " + errorBody));
                        });
                    }) //
                    .bodyToMono(String.class) //
                    .block();
        } catch (WebClientResponseException e) {
            // This exception is thrown for HTTP status code errors
            throw new RuntimeException("Error: " + e.getMessage() + " Status Code: " + e.getStatusCode(), e);
        } catch (WebClientRequestException e) {
            // This exception is thrown for errors while making the request (e.g., connectivity issues)
            throw new RuntimeException("Error: " + e.getMessage(), e);
        } catch (Exception e) {
            // This is a generic exception handler for other exceptions
            throw new RuntimeException("Error: " + e.getMessage(), e);
        }
        return response;
    }

    public static WebClient.Builder webClientBuilder() {
        int bufferSize = 100 * Const.ONE_MB;
        return WebClient.builder()
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(bufferSize)).build())
                .defaultHeader(HttpHeaders.USER_AGENT,
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3");
    }

    public static double calculateKBps(double bytes, double nanoseconds) {
        if (nanoseconds == 0)
            nanoseconds = 1; // avoid divide by zero

        // Convert nanoseconds to seconds
        double seconds = nanoseconds / 1e9; // 1e9 is 1 billion

        // Convert bytes to kilobytes
        double kilobytes = bytes / 1024.0; // 1 kilobyte = 1024 bytes

        // Calculate KBps
        return kilobytes / seconds;
    }

    public static boolean gracefulReadyCheck(ServletResponse res) throws RuntimeException, IOException {
        if (!MongoRepository.fullInit) {
            sleep(2000);
        }
        if (!MongoRepository.fullInit) {
            sleep(3000);
        }
        if (!MongoRepository.fullInit) {
            sleep(5000);
        }
        if (!MongoRepository.fullInit) {
            if (res instanceof HttpServletResponse o) {
                try {
                    o.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                } catch (Exception e) {
                }
            } else { // silently ignore this exception.
                throw new RuntimeException("Server not yet started.");
            }
        }
        return MongoRepository.fullInit;
    }

    // supposedly in Java 17, we now have this: HexFormat.of().parseHex(s) that can replace this.
    public static byte[] hexStringToBytes(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];

        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4) + Character.digit(s.charAt(i + 1), 16));
        }
        return data;
    }

    public static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    /*
     * Generates a very strong unguessable token. We could also use JWT here, but for our architecture
     * the only requirement is unique and unguessable.
     */
    static long counter = 1357;

    public static String genStrongToken() {
        return String.valueOf(Math.abs(++counter + (new Date().getTime()) ^ Math.abs(rand.nextLong())));
    }

    public static boolean equalObjs(Object o1, Object o2) {
        if (o1 == null && o2 == null)
            return true;
        if (o1 != null && o2 == null)
            return false;
        if (o2 != null && o1 == null)
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
        if (query == null) {
            return url;
        } else {
            return url + "?" + query;
        }
    }

    public static HttpEntity<MultiValueMap<String, Object>> getBasicRequestEntity() {
        HttpHeaders headers = new HttpHeaders();
        MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
        return requestEntity;
    }

    public static String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);

        for (int i = 0; i < hash.length; i++) {
            String hex = Integer.toHexString(255 & hash[i]);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
