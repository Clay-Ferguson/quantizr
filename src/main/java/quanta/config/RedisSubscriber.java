package quanta.config;

import org.apache.commons.lang3.SerializationUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import quanta.util.XString;

@Component
public class RedisSubscriber implements MessageListener {

    @Autowired
    private AppProp prop;

    private static Logger log = LoggerFactory.getLogger(RedisSubscriber.class);

    public void onMessage(Message message, byte[] pattern) {
        Object msg = SerializationUtils.deserialize(message.getBody());
        log.debug("Message received by replica " + prop.getSwarmTaskSlot() + ": [" + msg.getClass().getName() + "]"
                + XString.prettyPrint(msg));

        if (msg instanceof RedisBrowserPushInfo) {
            // todo-0: push to browser IF we have connection to browser
        }
    }
}
