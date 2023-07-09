package quanta.config;

import org.apache.commons.lang3.SerializationUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import quanta.service.PushService;

@Component
public class RedisSubscriber implements MessageListener {

    @Autowired
    private PushService push;

    private static Logger log = LoggerFactory.getLogger(RedisSubscriber.class);

    public void onMessage(Message message, byte[] pattern) {
        // todo-0: needs to use JSON serializing
        if (true)
            return;
        Object msg = SerializationUtils.deserialize(message.getBody());

        if (msg instanceof RedisBrowserPushInfo) {
            push.maybePushToBrowser((RedisBrowserPushInfo) msg);
        }
    }
}
