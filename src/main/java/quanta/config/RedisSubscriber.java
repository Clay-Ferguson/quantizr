package quanta.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.response.FeedPushInfo;
import quanta.service.PushService;
import quanta.util.XString;

@Component
public class RedisSubscriber implements MessageListener {
    private static Logger log = LoggerFactory.getLogger(RedisSubscriber.class);

    ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private PushService push;

    public void onMessage(Message message, byte[] pattern) {
        try {
            RedisBrowserPushInfo obj =
                    (RedisBrowserPushInfo) objectMapper.readValue(message.toString(), RedisBrowserPushInfo.class);

            if (obj.getType().equals(FeedPushInfo.class.getName())) {
                push.maybePushToBrowser(obj);
            } else {
                log.debug("RedisSubscriber (Unhandled): obj.class=" + obj.getClass().getName() + ": "
                        + XString.prettyPrint(obj));
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
