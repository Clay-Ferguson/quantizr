package quanta.mongo;

import java.util.HashMap;
import java.util.function.Supplier;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.mongo.model.SubNode;
import quanta.util.TL;

/**
 * Helper class to run some processing workload as the admin user. Simplifies by encapsulating the
 * session management at this abstracted layer.
 */
@Component
public class AdminRun extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(AdminRun.class);

    /**
     * Executes the provided operation with administrative privileges. If the current thread already has
     * admin authority, executes the operation directly. Otherwise, temporarily grants admin authority,
     * executes the operation, and restores the original state afterward.
     *
     * @param <T> The type of result returned by the operation
     * @param runner The operation to execute with admin privileges
     * @return The result of the operation
     */
    public <T> T run(Supplier<T> runner) {
        boolean hasAdminAuth = TL.getHasAdminAuthority();

        // if this thread is already with Admin Authority we're done and can just call the runner.
        if (hasAdminAuth) {
            return runner.get();
        }

        // Otherwise we'll be running as admin.
        HashMap<ObjectId, SubNode> dirtyNodes = TL.getDirtyNodes();
        TL.setDirtyNodes(null);
        TL.setHasAdminAuthority(true);

        // Run in the context of admin, and restore the original thread state afterwards
        T result = null;
        try {
            result = runner.get();
            svc_mongoUpdate.saveSession(true);
        } catch (Exception ex) {
            log.error("Error executing admin operation: {}", ex.getMessage(), ex);
            throw ex;
        } finally {
            TL.setDirtyNodes(dirtyNodes);
            TL.setHasAdminAuthority(hasAdminAuth);
        }
        return result;
    }
}
