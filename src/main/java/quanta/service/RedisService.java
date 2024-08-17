package quanta.service;

import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.mongo.MongoRepository;
import quanta.util.DateUtil;

@Component
public class RedisService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(RedisService.class);

    @Autowired
    private RedisTemplate<String, SessionContext> rops;

    @Autowired
    private ChannelTopic topic;

    public void publish(Object message) {
        rops.convertAndSend(topic.getTopic(), message);
    }

    public void save(SessionContext sc) {
        if (sc.getUserToken() == null)
            return;
        rops.opsForValue().set(sc.getUserToken(), sc);
    }

    public void delete(SessionContext sc) {
        if (sc.getUserToken() == null)
            return;
        if (rops.delete(sc.getUserToken())) {
            log.debug("Redis Token Deleted: " + sc.getUserToken());
        }
    }

    public SessionContext get(String token) {
        if (StringUtils.isEmpty(token))
            return null;
        SessionContext sc = rops.opsForValue().get(token);
        if (sc == null) {
            log.debug("unknown redis token: " + token);
        }
        return sc;
    }

    public List<SessionContext> query(String pattern) {
        LinkedList<SessionContext> list = new LinkedList<>();
        Set<String> keys = rops.keys(pattern);
        if (keys != null) {
            for (String key : keys) {
                list.add(rops.opsForValue().get(key));
            }
        }
        return list;
    }

    // Note: This happens to be about the same as the session timeout, but doesn't need to be
    int redisService_runCount = 0;

    @Scheduled(fixedDelay = 60 * DateUtil.MINUTE_MILLIS)
    public void maintenance() {
        redisService_runCount++;
        if (!initComplete || !MongoRepository.fullInit)
            return;

        // This first run will happen at startup and we don't want that.
        if (redisService_runCount == 1) {
            log.debug("redisService.run() first run, skipping.");
        }

        svc_arun.run(() -> {
            List<SessionContext> list = svc_redis.query("*");
            if (list.size() > 0) {
                int timeoutMillis = (int) (svc_prop.getSessionTimeoutMinutes() * DateUtil.MINUTE_MILLIS);
                Date now = new Date();

                rops.execute(new SessionCallback<List<Object>>() {
                    @Override
                    public <K, V> List<Object> execute(RedisOperations<K, V> operations) throws DataAccessException {
                        rops.multi();

                        for (SessionContext sc : list) {
                            if (sc.getLastActiveTime() < now.getTime() - timeoutMillis) {
                                rops.delete(sc.getUserToken());
                            }
                        }
                        // This will contain the results of all operations in the transaction
                        return rops.exec();
                    }
                });
            }
            return null;
        });
    }
}
