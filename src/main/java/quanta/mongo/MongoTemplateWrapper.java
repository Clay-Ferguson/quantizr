package quanta.mongo;

import com.mongodb.client.result.DeleteResult;
import java.util.List;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.BulkOperations.BulkMode;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.PrivilegeType;
import quanta.mongo.model.SubNode;
import quanta.util.DateUtil;
import quanta.util.ThreadLocals;

/**
 * This is a level of indirection around MongoTemplate so we can do various cross-cutting concerns,
 * like logging, security, etc.
 */
@Component
public class MongoTemplateWrapper extends ServiceBase {
    // todo-2: make this able to be enabled by Admin panel button
    private static boolean logging = false;
    private static Logger log = LoggerFactory.getLogger(MongoTemplateWrapper.class);

    @Autowired
    MongoTemplate mt;

    public DeleteResult remove(MongoSession ms, Query query, Class<?> entityClass) {
        long start = 0L;
        if (logging) {
            log("remove", ms, query);
            start = System.currentTimeMillis();
        }

        DeleteResult res = mt.remove(query, entityClass);
        if (logging) {
            log.debug("removed=" + res.getDeletedCount() + "time="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return res;
    }

    public long count(MongoSession ms, Query query, Class<?> entityClass) {
        long start = 0L;
        // not needed -> secure(ms, query, true, true, true);
        if (logging) {
            log("count", ms, query);
            start = System.currentTimeMillis();
        }

        long count = count(null, query);
        if (logging) {
            log.debug(
                    "count=" + count + "t=" + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return count;
    }

    public boolean exists(MongoSession ms, Query query, Class<?> entityClass) {
        long start = 0L;
        // not needed -> secure(ms, query, true, true, true);
        if (logging) {
            log("exists", ms, query);
            start = System.currentTimeMillis();
        }

        boolean exists = mt.exists(query, entityClass);
        if (logging) {
            log.debug("exists: " + exists + "t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return exists;
    }

    public <T> List<T> find(MongoSession ms, Query query, Class<T> entityClass) {
        return find(ms, query, entityClass, true, true, true);
    }

    public <T> List<T> find(MongoSession ms, Query query, Class<T> entityClass, boolean allowPublic, boolean toMe,
            boolean mine) {
        long start = 0L;
        if (logging) {
            log("find", ms, query);
            start = System.currentTimeMillis();
        }

        List<T> res = mt.find(query, entityClass);
        long count = res != null ? res.size() : 0;
        if (logging) {
            log.debug(
                    "count: " + count + "t=" + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return res;
    }

    public <T> T findOne(MongoSession ms, Query query, Class<T> entityClass) {
        long start = 0L;
        if (logging) {
            log("findOne", ms, query);
            start = System.currentTimeMillis();
        }

        T obj = mt.findOne(query, entityClass);
        if (logging) {
            log.debug((obj != null ? "found " : "not found ") + "t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return obj;
    }

    public DeleteResult remove(MongoSession ms, Query query) {
        long start = 0L;
        if (logging) {
            log("remove", ms, query);
            start = System.currentTimeMillis();
        }

        DeleteResult res = mt.remove(query, SubNode.class);
        if (logging) {
            log.debug("removed: " + res.getDeletedCount() + "t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return res;
    }

    public long count(MongoSession ms, Query query) {
        long start = 0L;
        // not needed -> secure(ms, query, true, true, true);
        if (logging) {
            log("count", ms, query);
            start = System.currentTimeMillis();
        }

        long count = mt.count(query, SubNode.class);
        if (logging) {
            log.debug("count: " + count + " t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return count;
    }

    public boolean exists(MongoSession ms, Query query) {
        long start = 0L;
        // not needed -> secure(ms, query, true, true, true);
        if (logging) {
            log("exists", ms, query);
            start = System.currentTimeMillis();
        }

        boolean exists = mt.exists(query, SubNode.class);
        if (logging) {
            log.debug("exists: " + exists + " t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return exists;
    }

    public List<SubNode> find(MongoSession ms, Query query) {
        long start = 0L;
        if (logging) {
            log("find", ms, query);
            start = System.currentTimeMillis();
        }

        List<SubNode> res = mt.find(query, SubNode.class);
        long count = res != null ? res.size() : 0;
        if (logging) {
            log.debug("count: " + count + " t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return res;
    }

    public SubNode findOne(MongoSession ms, Query query) {
        long start = 0L;
        if (logging) {
            log("findOne", ms, query);
            start = System.currentTimeMillis();
        }

        SubNode obj = mt.findOne(query, SubNode.class);
        if (logging) {
            log.debug((obj != null ? ("found: " + obj.getIdStr()) : "not found") + " t="
                    + DateUtil.formatDurationMillis(System.currentTimeMillis() - start, true));
        }
        return obj;
    }

    public SubNode findById(MongoSession ms, Object id) {
        if (id == null)
            return null;
        SubNode obj = mt.findById(id, SubNode.class);
        if (obj != null && ms != null) {
            auth.auth(ms, obj, PrivilegeType.READ);
        }
        return obj;
    }

    private void log(String name, MongoSession ms, Query query) {
        log.debug("MQ: cmd:" + //
                (ThreadLocals.getSC() != null && ThreadLocals.getSC().getCommand() != null
                        ? ThreadLocals.getSC().getCommand()
                        : "?")
                + " u:" + (ms == null || ms.getUserName() == null ? "null" : ms.getUserName()) + " q:" + name + " "
                + query.toString());
    }

    public BulkOperations bulkOps(BulkMode bulkMode, Class<?> entityClass) {
        return mt.bulkOps(bulkMode, entityClass);
    }

    public <O> AggregationResults<O> aggregate(Aggregation aggregation, Class<?> inputType, Class<O> outputType) {
        return mt.aggregate(aggregation, inputType, outputType);
    }

    public <T> T save(T objectToSave) {
        return mt.save(objectToSave);
    }

    public IndexOperations indexOps(Class<?> entityClass) {
        return mt.indexOps(entityClass);
    }

    public <T> List<T> findAll(Class<T> entityClass) {
        return mt.findAll(entityClass);
    }

    public DeleteResult remove(Object object) {
        return mt.remove(object);
    }

    public <T> Stream<T> stream(Query query, Class<T> entityType) {
        return mt.stream(query, entityType);
    }

    public <T> T findAndModify(Query query, UpdateDefinition update, Class<T> entityClass) {
        return mt.findAndModify(query, update, entityClass);
    }

    public <T> void dropCollection(Class<T> entityClass) {
        mt.dropCollection(entityClass);
    }
}
