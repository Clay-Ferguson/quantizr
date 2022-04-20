package quanta.service;

import java.io.InputStream;
import java.net.URL;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import quanta.config.AppProp;
import quanta.config.ServiceBase;
import quanta.util.Util;

@Component
public class IPFSCat extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(IPFSCat.class);

    @Autowired
    private AppProp prop;

    public static String API_BASE;
    public static String API_CAT;

    @PostConstruct
    public void init() {
        API_BASE = prop.getIPFSApiHostAndPort() + "/api/v0";
        API_CAT = API_BASE + "/cat";
    }

    /**
     * Reads the bytes from 'ipfs hash', expecting them to be UTF-8 and returns the string.
     * 
     * NOTE: The hash is allowed to have a subpath here.
     */
    public String getString(String hash) {
        String ret = null;
        try {
            String url = API_CAT + "?arg=" + hash;
            ResponseEntity<String> response =
                    ipfs.restTemplate.exchange(url, HttpMethod.POST, Util.getBasicRequestEntity(), String.class);
            ret = response.getBody();
            // log.debug("IPFS post cat. Ret " + response.getStatusCode() + "] " + ret);
        } catch (Exception e) {
            log.error("Failed to cat: " + hash, e);
        }
        return ret;
    }

    public InputStream getInputStream(String hash) {
        String url = API_CAT + "?arg=" + hash;
        InputStream is = null;
        try {
            is = new URL(url).openStream();
        } catch (Exception e) {
            log.error("Failed in read: " + url, e);
        }
        return is;
    }
}
