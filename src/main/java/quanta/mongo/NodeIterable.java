package quanta.mongo;

import java.util.Iterator;
import quanta.mongo.model.SubNode;

/**
 * Wraps iterable we get from queries so that one by one we can detect any nodes that are already
 * being operated on in memory and make sure we point to THOSE in memory nodes, to avoid types of
 * dirty writes
 */
class NodeIterable implements Iterable<SubNode> {
    private final Iterable<SubNode> iter;

    public NodeIterable(Iterable<SubNode> iter) {
        this.iter = iter;
    }

    public Iterator<SubNode> iterator() {
        return new NodeIterator(iter.iterator());
    }
}
