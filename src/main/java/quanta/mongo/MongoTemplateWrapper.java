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
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.perf.PerfEvent;
import quanta.util.TL;

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
    private static boolean logging = false;
    private static Logger log = LoggerFactory.getLogger(MongoTemplateWrapper.class);

    @Autowired
    MongoTemplate mt;

    // NOTE: The purpose of this wrapper function is only to add logging, error handling, and
    // performance monitoring.
    private <T> T executeOperation(Query query, String operationName, Supplier<T> operation) {
        String user = TL.getSC() != null ? TL.getSC().getUserName() : "[admin-thread]";

        try (PerfEvent pe = new PerfEvent(operationName, user)) {
            if (logging) {
                log(operationName, query);
            }

            return operation.get();
        } catch (Exception e) {
            log.error("Mongo OP failed: " + operationName + "\n" + ExceptionUtils.getStackTrace(e));
            throw new RuntimeException(e);
        }
    }

    public DeleteResult remove(Query query) {
        return executeOperation(query, "remove", () -> mt.remove(query, SubNode.class));
    }

    public long count(Query query) {
        return executeOperation(query, "count", () -> mt.count(query, SubNode.class));
    }

    public boolean exists(Query query) {
        return executeOperation(query, "exists", () -> mt.exists(query, SubNode.class));
    }

    public List<SubNode> find(Query query) {
        List<SubNode> nodes = executeOperation(query, "find", () -> mt.find(query, SubNode.class));
        return nodes;
    }

    // This is used to find the DB root BEFORE the adminSessionContext is built so any kind of actual
    // security
    // code must be bypassed so we call directly onto 'mt.findOne' instead of thru executeOptionation
    public SubNode adminFindOne(Query query) {
        SubNode node = mt.findOne(query, SubNode.class);
        return node;
    }

    public SubNode findOne(Query query) {
        return findOne(query, SubNode.class);
    }

    public <T extends SubNode> T findOne(Query query, Class<T> clazz) {
        T node = executeOperation(query, "findOne", () -> mt.findOne(query, clazz));
        return node;
    }

    public AccountNode findUserAccountNode(Query query) {
       return findOne(query, AccountNode.class);
    }

    public SubNode findById(Object id) {
        return findById(id, SubNode.class);
    }

    public <T extends SubNode> T findById(Object id, Class<T> clazz) {
        if (id == null)
            return null;

        return executeOperation(null, "findById", () -> {
            T node = mt.findById(id, clazz);

            if (node != null) {
                svc_auth.readAuth(node);
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
        // if (ret != null && ret.getMappedResults() != null) {
        //     ret.getMappedResults().forEach(n -> svc_mongoUtil.validate(n));
        // }

        return ret;
    }

    public SubNode save(SubNode node) {
        MongoUtil.validate(node);
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
            consumer.accept(n);
        });
    }

    public SubNode findAndModify(Query query, UpdateDefinition update) {
        return mt.findAndModify(query, update, SubNode.class);
    }

    public void dropCollection() {
        mt.dropCollection(SubNode.class);
    }

    private void log(String name, Query query) {
        String msg = "MQ: cmd:" + //
                (TL.getSC().getCommand() != null ? TL.getSC().getCommand() : "?") + " u:"
                + (TL.getSC().getUserName() == null ? "null" : TL.getSC().getUserName()) + " q:" + name + " ";

        if (query != null) {
            msg += query.toString();
        }
        log.debug(msg);
    }
}
