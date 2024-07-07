package quanta.mongo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import quanta.util.ExUtil;

public class CustomMongoTransactionManager extends MongoTransactionManager {
    private static Logger log = LoggerFactory.getLogger(CustomMongoTransactionManager.class);

    public CustomMongoTransactionManager(MongoDatabaseFactory dbFactory) {
        super(dbFactory);
    }

    @Override
    protected void doRollback(DefaultTransactionStatus status) {
        try {
            super.doRollback(status);
        } catch (Exception e) {
            ExUtil.error(log, "Rolling back MongoDB Trans", e);
            throw e;
        }
    }
}
