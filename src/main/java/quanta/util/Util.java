package quanta.util;

import java.io.IOException;
import java.util.Date;
import java.util.Random;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import quanta.mongo.MongoRepository;

public class Util {

    private static Logger log = LoggerFactory.getLogger(Util.class);
    private static final Random rand = new Random();

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

    // extracts mime from this type of url: data:image/png;base64,[data...]
    public static String getMimeFromDataUrl(String url) {
        int colonIdx = url.indexOf(":");
        int semiColonIdx = url.indexOf(";");
        String mime = url.substring(colonIdx + 1, semiColonIdx);
        return mime;
    }

    public static HttpEntity<MultiValueMap<String, Object>> getBasicRequestEntity() {
        HttpHeaders headers = new HttpHeaders();
        MultiValueMap<String, Object> bodyMap = new LinkedMultiValueMap<>();
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(bodyMap, headers);
        return requestEntity;
    }
}
