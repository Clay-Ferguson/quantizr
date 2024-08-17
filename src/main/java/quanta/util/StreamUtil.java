package quanta.util;

import java.io.BufferedInputStream;
import java.io.Closeable;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import javax.imageio.ImageReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

public class StreamUtil {
    private static Logger log = LoggerFactory.getLogger(StreamUtil.class);

    public static InputStream getStream(String sourceUrl, int timeout, final int maxFileSize) {
        try {
            final ExchangeStrategies strategies = ExchangeStrategies.builder()
                    .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(maxFileSize)).build();

            WebClient webClient = Util.webClientBuilder().exchangeStrategies(strategies)
                    .defaultHeader(HttpHeaders.USER_AGENT, Const.FAKE_USER_AGENT).build();

            Mono<ByteArrayResource> result = webClient.get().uri(URI.create(sourceUrl)).retrieve()
                    .bodyToMono(ByteArrayResource.class).timeout(Duration.ofSeconds(timeout));

            ByteArrayResource resource = result.block();
            InputStream is = resource.getInputStream();
            return is;
        } catch (Exception e) {
            ExUtil.error(log, "Failed Reading: " + sourceUrl, e);
            throw new RuntimeException("Stream failed. Are you out of server storage space?");
        }
    }

    public static LimitedInputStreamEx getLimitedStream(String sourceUrl, int timeout, final int maxFileSize) {
        InputStream is = getStream(sourceUrl, timeout, maxFileSize);
        LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(is, maxFileSize);
        return limitedIs;
    }

    public static void close(Object... objects) {
        for (Object obj : objects) {
            if (obj instanceof Closeable o) {
                try {
                    o.close();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else if (obj instanceof ImageReader o) {
                try {
                    o.dispose();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else {
                if (obj != null) {
                    log.warn("Object to close was of unsupported type: " + obj.getClass().getName());
                }
            }
        }
    }

    @SuppressWarnings("resource")
    public static boolean streamsIdentical(InputStream a, InputStream b) {
        // wrap in Buffered streams only if not currently buffered
        BufferedInputStream aBuffered = (a instanceof BufferedInputStream o) ? o : new BufferedInputStream(a);
        BufferedInputStream bBuffered = (b instanceof BufferedInputStream o) ? o : new BufferedInputStream(b);
        try {
            int aByte;
            int bByte;
            // read a byte from "a"
            while ((aByte = aBuffered.read()) != -1) {
                // if got an "a" but can't get a 'b' then streams are not same length, and this is the case where
                // stream "a" was longer
                if ((bByte = bBuffered.read()) == -1) {
                    return false;
                }
                // if we got both bytes, compare them
                if (aByte != bByte) {
                    return false;
                }
            }
            // once we ran to end of stream "a" make sure stream 'b' is also ended (checking that 'b' isn't
            // longer than "a")
            if (bBuffered.read() != -1) {
                return false;
            }
        } catch (Exception ex) {
            throw ExUtil.wrapEx(ex);
        } finally {
            close(aBuffered, bBuffered);
        }
        return true;
    }
}
