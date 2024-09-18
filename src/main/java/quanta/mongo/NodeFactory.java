package quanta.mongo;

import java.lang.reflect.Constructor;
import org.bson.types.ObjectId;
import quanta.mongo.model.SubNode;

// todo-0: we can make these templated so that the return value doesn't have to be casted
public class NodeFactory {
    // Factory method for creating instances with default constructor
    public static SubNode createNode(Class<? extends SubNode> nodeClass) {
        try {
            Constructor<? extends SubNode> constructor = nodeClass.getConstructor();
            return constructor.newInstance();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create node instance", e);
        }
    }

    // Factory method for creating instances with parameterized constructor
    public static SubNode createNode(Class<? extends SubNode> nodeClass, ObjectId owner, String path, String type, Long ordinal) {
        try {
            Constructor<? extends SubNode> constructor = nodeClass.getConstructor(ObjectId.class, String.class, String.class, Long.class);
            return constructor.newInstance(owner, path, type, ordinal);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create node instance", e);
        }
    }
}
