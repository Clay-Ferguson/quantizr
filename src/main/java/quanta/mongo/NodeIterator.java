package quanta.mongo;

import static quanta.util.Util.ok;
import java.util.Iterator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;

/**
 * Wraps iterators we get from queries so that one by one we can detect any nodes that are already
 * being operated on in memory and make sure we point to THOSE in memory nodes, to avoid types of
 * dirty writes.
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
        if (ok(node)) {
            // similar to nodeOrDirtyNode logic...
            SubNode dirty = ThreadLocals.getDirtyNodes().get(node.getId());
            if (ok(dirty)) {
                // log.debug("ITER-WRAPPER: Got a dirty one: " + dirty.getIdStr());
                return dirty;
            }
        }
        // log.debug("ITER-WRAPPER: " + node.getIdStr());
        return node;
    }

    @Override
    public boolean hasNext() {
        return iter.hasNext();
    }
}
