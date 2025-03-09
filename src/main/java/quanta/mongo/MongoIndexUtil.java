package quanta.mongo;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.data.mongodb.core.index.TextIndexDefinition.TextIndexDefinitionBuilder;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.NodeLink;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.ExUtil;

/**
 * Verious utilities related to MongoDB persistence
 */
@Component
public class MongoIndexUtil extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(MongoIndexUtil.class);

    public void createAllIndexes() {
        log.debug("checking all indexes.");
        // DO NOT DELETE. This is able to check contstraint volations.
        // read.dumpByPropertyMatch(NodeProp.USER.s(), "adam");

        createUniqueIndex(SubNode.PATH);

        // Other indexes that *could* be added but we don't, just as a performance enhancer is
        // Unique node names: Key = node.owner+node.name (or just node.name for admin)
        // Unique Friends: Key = node.owner+node.friendId? (meaning only ONE Friend type node per user
        // account)
        // This index is obsolete but we keep as an example of this kind of index.
        // createPartialUniqueIndex(ms, "unique-apid", SubNode.class, SubNode.PROPS + "." +
        // NodeProp.OBJECT_ID.s());

        createPartialIndex("rdf-i", SubNode.LINKS + "." + NodeLink.ID);
        createPartialUniqueIndexForType("unique-user-acct", SubNode.PROPS + "." + NodeProp.USER.s(),
                NodeType.ACCOUNT.s());

        /*
         * DO NOT DELETE: This is a good example of how to cleanup the DB of all constraint violations prior
         * to adding some new constraint. And this one was for making sure the "UniqueFriends" Index could
         * be built ok. You can't create such an index until violations of it are already removed.
         * delete.removeFriendConstraintViolations(ms);
         */

        createUniqueFriendsIndex();
        createUniqueNodeNameIndex();
        // DO NOT DELETE
        // I had done this temporarily to fix a constraint violation
        // dropIndex(ms, SubNode.class, "unique-friends");
        // dropIndex(ms, SubNode.class, "unique-node-name");
        // NOTE: Every non-admin owned noded must have only names that are prefixed with "UserName--" of
        // the user. That is, prefixed by their username followed by two dashes.
        createIndex(SubNode.NAME);
        createIndex(SubNode.TYPE);
        createIndex(SubNode.OWNER);
        createIndex(SubNode.XFR);
        createIndex(SubNode.ORDINAL);
        createIndex(SubNode.MODIFY_TIME, Direction.DESC);
        createIndex(SubNode.CREATE_TIME, Direction.DESC);
        createTextIndexes();
        logIndexes();
        log.debug("finished checking all indexes.");
    }

    /*
     * Creates an index which will guarantee no duplicate friends can be created for a given user. Note
     * this one index also makes it impossible to have the same user both blocked and followed because
     * those are both saved as FRIEND nodes on the tree and therefore would violate this constraint
     * which is exactly what we want.
     */
    public void createUniqueFriendsIndex() {
        log.debug("Creating unique friends index.");
        svc_auth.requireAdmin();
        String indexName = "unique-friends";
        try {
            svc_ops.indexOps().ensureIndex(new Index().on(SubNode.OWNER, Direction.ASC)
                    .on(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s(), Direction.ASC).unique().named(indexName)
                    .partial(PartialIndexFilter.of(Criteria.where(SubNode.TYPE).is(NodeType.FRIEND.s()))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
        }
    }

    /* Creates an index which will guarantee no duplicate node names can exist, for any user */
    public void createUniqueNodeNameIndex() {
        log.debug("createUniqueNodeNameIndex()");
        svc_auth.requireAdmin();
        String indexName = "unique-node-name";
        try {
            svc_ops.indexOps().ensureIndex(new Index().on(SubNode.OWNER, Direction.ASC).on(SubNode.NAME, Direction.ASC)
                    .unique().named(indexName).partial(PartialIndexFilter.of(Criteria.where(SubNode.NAME).gt(""))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + indexName, e);
        }
    }

    public void dropAllIndexes() {
        log.debug("dropAllIndexes");
        svc_auth.requireAdmin();
        svc_ops.indexOps().dropAllIndexes();
    }

    public void dropIndex(String indexName) {
        try {
            svc_auth.requireAdmin();
            log.debug("Dropping index: " + indexName);
            svc_ops.indexOps().dropIndex(indexName);
        } catch (Exception e) {
            ExUtil.error(log, "exception in dropIndex: " + indexName, e);
        }
    }

    public void logIndexes() {
        StringBuilder sb = new StringBuilder();
        sb.append("INDEXES LIST\n:");
        List<IndexInfo> indexes = svc_ops.indexOps().getIndexInfo();

        for (IndexInfo idx : indexes) {
            List<IndexField> indexFields = idx.getIndexFields();
            sb.append("INDEX EXISTS: " + idx.getName() + "\n");

            for (IndexField idxField : indexFields) {
                sb.append("    " + idxField.toString() + "\n");
            }
        }
        log.debug(sb.toString());
    }

    /*
     * WARNING: I wote this but never tested it, nor did I ever find any examples online. Ended up not
     * needing any compound indexes (yet)
     */
    public void createPartialUniqueIndexComp2(String name, String property1, String property2) {
        svc_auth.requireAdmin();
        try {
            // Ensures unuque values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property1, Direction.ASC).on(property2, Direction.ASC).unique().named(name).partial(
                            PartialIndexFilter.of(Criteria.where(property1).exists(true).and(property2).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    /*
     * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid works
     */
    public void createPartialIndex(String name, String property) {
        log.debug("Ensuring partial index named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unique values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).named(name)
                            .partial(PartialIndexFilter.of(Criteria.where(property).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    /*
     * NOTE: Properties like this don't appear to be supported: "prp['ap:id'].value", but prp.apid works
     */
    public void createPartialUniqueIndex(String name, String property) {
        log.debug("Ensuring unique partial index named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unique values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).unique().named(name)
                            .partial(PartialIndexFilter.of(Criteria.where(property).exists(true))));
            log.debug("Index verified: " + name);
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    public void createPartialUniqueIndexForType(String name, String property, String type) {
        log.debug("Ensuring unique partial index (for type) named: " + name);
        svc_auth.requireAdmin();
        try {
            // Ensures unique values for 'property' (but allows duplicates of nodes missing the property)
            svc_ops.indexOps().ensureIndex(
                    // Note: also instead of exists, something like ".gt('')" would probably work too
                    new Index().on(property, Direction.ASC).unique().named(name).partial(PartialIndexFilter.of( //
                            Criteria.where(SubNode.TYPE).is(type).and(property).exists(true))));
        } catch (Exception e) {
            ExUtil.error(log, "Failed to create partial unique index: " + name, e);
        }
    }

    public void createUniqueIndex(String property) {
        log.debug("Ensuring unique index on: " + property);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, Direction.ASC).unique());
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createUniqueIndex: " + property, e);
        }
    }

    public void createIndex(String property) {
        log.debug("createIndex: " + property);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, Direction.ASC));
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createIndex: " + property, e);
        }
    }

    public void createIndex(String property, Direction dir) {
        log.debug("createIndex: " + property + " dir=" + dir);
        try {
            svc_auth.requireAdmin();
            svc_ops.indexOps().ensureIndex(new Index().on(property, dir));
        } catch (Exception e) {
            ExUtil.error(log, "Failed in createIndex: " + property + " dir=" + dir, e);
        }
    }

    /*
     * DO NOT DELETE.
     *
     * I tried to create just ONE full text index, and i get exceptions, and even if i try to build a
     * text index on a specific property I also get exceptions, so currently i am having to resort to
     * using only the createTextIndexes() below which does the 'onAllFields' option which DOES work for
     * some readonly
     */
    // public void createUniqueTextIndex(Class<?> clazz,
    // String property) {
    // requireAdmin(session);
    //
    // TextIndexDefinition textIndex = new
    // TextIndexDefinitionBuilder().onField(property).build();
    //
    // /* If mongo will not allow dupliate checks of a text index, i can simply take
    // a HASH of the
    // content text, and enforce that's unique
    // and while i'm at it secondarily use it as a corruption check.
    //
    // DBObject dbo = textIndex.getIndexOptions();
    // dbo.put("unique", true);
    // dbo.put("dropDups", true);
    //
    // opsw.indexOps(clazz).ensureIndex(textIndex);
    // }

    public void createTextIndexes() {
        log.debug("creatingText Indexes.");
        svc_auth.requireAdmin();
        try {
            // Using 'none' as default language allows `stop words` to be indexed, which are words usually
            // not searched for like "and, of, the, about, over" etc, however if you index without stop words
            // that also means searching for these basic words in the content fails. But if you do index them
            // (by using "none" here) then the index will be larger.
            TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().withDefaultLanguage("none")//
                    .onField(SubNode.CONTENT) //
                    .onField(SubNode.TAGS) //
                    .build();
            // TextIndexDefinition textIndex = new TextIndexDefinitionBuilder().onAllFields().build();

            svc_ops.indexOps().ensureIndex(textIndex);
            log.debug("createTextIndex successful.");
        } catch (Exception e) {
            log.debug("createTextIndex failed.");
        }
    }

    public void rebuildIndexes() {
        dropAllIndexes();
        createAllIndexes();
    }
}
