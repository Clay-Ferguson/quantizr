package quanta.config;

import org.apache.commons.lang3.SerializationUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import quanta.util.XString;

@Component
public class RedisMessageSubscriber implements MessageListener {

    ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private AppProp prop;

    private static Logger log = LoggerFactory.getLogger(RedisMessageSubscriber.class);

    public void onMessage(Message message, byte[] pattern) {
        RedisMessage msg = (RedisMessage) SerializationUtils.deserialize(message.getBody());
        log.debug("Message received by replica " + prop.getSwarmTaskSlot() + ": " + XString.prettyPrint(msg));
    }
}
