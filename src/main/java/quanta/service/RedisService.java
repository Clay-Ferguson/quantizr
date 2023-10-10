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
import quanta.instrument.PerfMonEvent;
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
        long start = System.currentTimeMillis();
        rops.opsForValue().set(sc.getUserToken(), sc);
        new PerfMonEvent(System.currentTimeMillis() - start, "redisSave", sc.getUserName());
    }

    public void delete(SessionContext sc) {
        if (sc.getUserToken() == null)
            return;
        long start = System.currentTimeMillis();
        if (rops.delete(sc.getUserToken())) {
            log.debug("Redis Token Deleted: " + sc.getUserToken());
        }
        new PerfMonEvent(System.currentTimeMillis() - start, "redisDel", sc.getUserName());
    }

    public SessionContext get(String token) {
        if (StringUtils.isEmpty(token))
            return null;
        long start = System.currentTimeMillis();
        SessionContext sc = rops.opsForValue().get(token);
        if (sc != null) {
            new PerfMonEvent(System.currentTimeMillis() - start, "redisGet", sc.getUserName());
        } else {
            log.debug("unknown redis token: " + token);
        }
        return sc;
    }

    public List<SessionContext> query(String pattern) {
        long start = System.currentTimeMillis();
        LinkedList<SessionContext> list = new LinkedList<>();
        Set<String> keys = rops.keys(pattern);
        if (keys != null) {
            for (String key : keys) {
                list.add(rops.opsForValue().get(key));
            }
        }
        new PerfMonEvent(System.currentTimeMillis() - start, "redisQuery", "_sys_");
        return list;
    }

    // Note: This happens to be about the same as the session timeout, but doesn't need to be
    @Scheduled(fixedDelay = 60 * DateUtil.MINUTE_MILLIS)
    public void maintenance() {
        if (!initComplete || !MongoRepository.fullInit)
            return;

        List<SessionContext> list = redis.query("*");
        if (list.size() > 0) {
            int timeoutMillis = (int) (prop.getSessionTimeoutMinutes() * DateUtil.MINUTE_MILLIS);
            Date now = new Date();

            rops.execute(new SessionCallback<List<Object>>() {
                public List<Object> execute(RedisOperations rops) throws DataAccessException {
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
    }
}
