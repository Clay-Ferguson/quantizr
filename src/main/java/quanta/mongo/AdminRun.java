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
 * session management at this abstracted layer. Run primarily as a Java-8 Lambda
 */
@Component
public class AdminRun extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(AdminRun.class);

    // Runs with full authority, but as the same user as on the current session.
    public <T> T run(Supplier<T> runner) {
        boolean saveHasAdminAuthority = TL.getHasAdminAuthority();

        // if this thread is already with Admin Authority we're done and can just call the runner.
        if (saveHasAdminAuthority) {
            return runner.get();
        }

        // Otherwise we're running as admin.
        HashMap<ObjectId, SubNode> savedDirtyNodes = TL.getDirtyNodes();
        TL.setDirtyNodes(null);
        TL.setHasAdminAuthority(true);

        // otherwise we need to run on the context of admin, and then restore the savedMs afterwards.
        T ret = null;
        try {
            ret = runner.get();
            svc_mongoUpdate.saveSession(true);
        } catch (Exception ex) {
            log.error("error", ex);
            throw ex;
        } finally {
            TL.setDirtyNodes(savedDirtyNodes);
            TL.setHasAdminAuthority(saveHasAdminAuthority);
        }
        return ret;
    }
}
