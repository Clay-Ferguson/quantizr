package org.subnode.mongo;

import java.util.Iterator;
import org.subnode.mongo.model.SubNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Wraps iterators we get from queries so that one by one we can detect any nodes that are already
 * being operated on in memory and make sure we point to THOSE in memory nodes, to avoid types of
 * dirty writes
 */
class NodeIterator implements Iterator<SubNode> {
    private static final Logger log = LoggerFactory.getLogger(NodeIterator.class);

    private final Iterator<SubNode> iter;

    public NodeIterator(Iterator<SubNode> iter) {
        this.iter = iter;
    }

    @Override
    public SubNode next() {
        SubNode node = iter.next();
        if (node != null) {
            SubNode dirty = MongoThreadLocal.getDirtyNodes().get(node.getId());
            if (dirty != null) {
                // log.debug("ITER-WRAPPER: Got a dirty one: " + dirty.getId().toHexString());
                return dirty;
            }
        }
        // log.debug("ITER-WRAPPER: " + node.getId().toHexString());
        return node;
    }

    @Override
    public boolean hasNext() {
        return iter.hasNext();
    }
}
