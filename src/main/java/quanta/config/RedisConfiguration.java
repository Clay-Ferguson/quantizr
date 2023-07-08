package quanta.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * https://www.baeldung.com/spring-data-redis-pub-sub
 * https://docs.spring.io/spring-data/data-redis/docs/current/reference/html/#tx.spring
 * https://github.com/spring-projects/spring-data-redis/blob/main/src/main/asciidoc/reference/redis-transactions.adoc
 */
@Configuration
public class RedisConfiguration {

    private static Logger log = LoggerFactory.getLogger(RedisConfiguration.class);

    @Bean
    public RedisTemplate<String, SessionContext> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, SessionContext> template = new RedisTemplate<>();
        template.setEnableTransactionSupport(true);
        template.setConnectionFactory(connectionFactory);
        // template.setDefaultSerializer(new StringRedisSerializer());
        template.setKeySerializer(new StringRedisSerializer());
        return template;
    }
}
