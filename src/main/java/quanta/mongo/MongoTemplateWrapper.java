package quanta.mongo;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.apache.commons.lang3.exception.ExceptionUtils;
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
import com.mongodb.client.result.DeleteResult;
import quanta.config.ServiceBase;
import quanta.mongo.model.SubNode;
import quanta.perf.PerfEvent;
import quanta.util.ThreadLocals;

/**
 * This is a level of indirection around MongoTemplate so we can do various cross-cutting concerns,
 * like logging, security, etc.
 * 
 * currently I'm adding onAfterLoad calls to this class, but I need to also be sure all
 * BulkOperations are also ran thru that method, probably by being wrapped into this class.
 */
@Component
public class MongoTemplateWrapper extends ServiceBase {
    // todo-2: make this able to be enabled by Admin panel button
    public static boolean logging = false;
    private static Logger log = LoggerFactory.getLogger(MongoTemplateWrapper.class);

    @Autowired
    MongoTemplate mt;

    private <T> T executeOperation(MongoSession ms, Query query, String operationName, Supplier<T> operation) {
        String user = (ms == null || ms.getUserName() == null ? "admin" : ms.getUserName());
        try (PerfEvent pe = new PerfEvent(operationName, user)) {
            if (logging) {
                log(operationName, ms, query);
            }

            return operation.get();
        } catch (Exception e) {
            log.error("Mongo OP failed: " + operationName + "\n" + ExceptionUtils.getStackTrace(e));
            throw new RuntimeException(e);
        }
    }

    public DeleteResult remove(MongoSession ms, Query query) {
        return executeOperation(ms, query, "remove", () -> mt.remove(query, SubNode.class));
    }

    public long count(MongoSession ms, Query query) {
        return executeOperation(ms, query, "count", () -> mt.count(query, SubNode.class));
    }

    public boolean exists(MongoSession ms, Query query) {
        return executeOperation(ms, query, "exists", () -> mt.exists(query, SubNode.class));
    }

    public List<SubNode> find(MongoSession ms, Query query) {
        List<SubNode> nodes = executeOperation(ms, query, "find", () -> mt.find(query, SubNode.class));
        if (nodes != null)
            nodes.forEach(n -> mongoUtil.validate(n));
        return nodes;
    }

    public SubNode findOne(MongoSession ms, Query query) {
        SubNode node = executeOperation(ms, query, "findOne", () -> mt.findOne(query, SubNode.class));
        if (node != null)
            mongoUtil.validate(node);
        return node;
    }

    public SubNode findById(MongoSession ms, Object id) {
        if (id == null)
            return null;

        return executeOperation(ms, null, "findById", () -> {
            SubNode node = mt.findById(id, SubNode.class);

            if (node != null) {
                mongoUtil.validate(node);
                // Note: Since this method doesn't accept a query object, we can't have secured the query before
                // calling this method like all other class methods do, so we check 'readAuth' here
                if (ms != null) {
                    auth.readAuth(ms, node);
                }
            }
            return node;
        });
    }

    public BulkOperations bulkOps(BulkMode bulkMode) {
        return mt.bulkOps(bulkMode, SubNode.class);
    }

    public AggregationResults<SubNode> aggregate(Aggregation aggregation) {
        AggregationResults<SubNode> ret = mt.aggregate(aggregation, SubNode.class, SubNode.class);

        // call onAfterLoad on all results
        if (ret != null && ret.getMappedResults() != null) {
            ret.getMappedResults().forEach(n -> mongoUtil.validate(n));
        }

        return ret;
    }

    public SubNode save(SubNode node) {
        mongoUtil.validate(node);
        return mt.save(node);
    }

    public IndexOperations indexOps() {
        return mt.indexOps(SubNode.class);
    }

    public DeleteResult remove(Object object) {
        return mt.remove(object);
    }

    public void forEach(Query query, Consumer<SubNode> consumer) {
        mt.stream(query, SubNode.class).forEach(n -> {
            mongoUtil.validate(n);
            consumer.accept(n);
        });
    }

    public SubNode findAndModify(Query query, UpdateDefinition update) {
        return mt.findAndModify(query, update, SubNode.class);
    }

    public void dropCollection() {
        mt.dropCollection(SubNode.class);
    }

    private void log(String name, MongoSession ms, Query query) {
        String msg = "MQ: cmd:" + //
                (ThreadLocals.getSC() != null && ThreadLocals.getSC().getCommand() != null
                        ? ThreadLocals.getSC().getCommand()
                        : "?")
                + " u:" + (ms == null || ms.getUserName() == null ? "null" : ms.getUserName()) + " q:" + name + " ";

        if (query != null) {
            msg += query.toString();
        }
        log.debug(msg);
    }
}
