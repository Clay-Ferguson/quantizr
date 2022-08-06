package quanta.actpub;

import java.security.PrivateKey;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.bson.types.ObjectId;
import org.springframework.stereotype.Component;
import quanta.actpub.model.APObj;
import quanta.config.ServiceBase;
import quanta.mongo.model.SubNode;

/**
 * Holds all the global caches related to AP.
 * 
 * #todo-optimization: need timer that cleans each of these out once every 8hrs.
 */
@Component
public class ActPubCache extends ServiceBase {
    /*
     * Holds users for which messages need refreshing (false value) but sets value to 'true' once
     * completed
     */
    public final ConcurrentHashMap<String, Boolean> usersPendingRefresh = new ConcurrentHashMap<>();

    public final ConcurrentHashMap<String, Boolean> allUserNames = new ConcurrentHashMap<>();

    /* Cache Actor objects by UserName in memory only for now */
    public final ConcurrentHashMap<String, APObj> actorsByUserName = new ConcurrentHashMap<>();

    /* Cache Actor URLS by UserName in memory only for now */
    public final ConcurrentHashMap<String, String> actorUrlsByUserName = new ConcurrentHashMap<>();

    /* Cache inboxes by UserName in memory only for now */
    public final ConcurrentHashMap<String, String> inboxesByUserName = new ConcurrentHashMap<>();

    /* Cache Actor objects by URL in memory only for now */
    public final ConcurrentHashMap<String, APObj> actorsByUrl = new ConcurrentHashMap<>();

    /* Cache of user account node Ids by actor url */
    public final ConcurrentHashMap<String, String> acctIdByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by actor Url */
    public final ConcurrentHashMap<String, SubNode> acctNodesByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by User Name */
    public final ConcurrentHashMap<String, SubNode> acctNodesByUserName = new ConcurrentHashMap<>();

    /* Account Node by node ID */
    public final ConcurrentHashMap<String, SubNode> acctNodesById = new ConcurrentHashMap<>();

    /* Cache WebFinger objects by UserName in memory only for now */
    public final ConcurrentHashMap<String, APObj> webFingerCacheByUserName = new ConcurrentHashMap<>();

    /* Cache WebFinger fails, so we don't try them again */
    public final Set<String> webFingerFailsByUserName = Collections.synchronizedSet(new HashSet<String>());

    /* Maps the string representation of a key to the PrivateKey object */
    public final ConcurrentHashMap<String, PrivateKey> privateKeys = new ConcurrentHashMap<>();

    public final HashSet<String> followedUsers = new HashSet<>();

    /*
     * Update cache, when nodes chagne. Yes, this is a bit of a tight-coupling to be calling this from
     * the MongoEventListener, when we could be using more of a pub-sub mode.
     */
    public void saveNotify(SubNode node) {
        final ObjectId objId = node.getId();

        acctNodesByActorUrl.forEach((k, v) -> {
            if (v.getId().equals(objId)) {
                acctNodesByActorUrl.put(k, node);
            }
        });

        acctNodesByUserName.forEach((k, v) -> {
            if (v.getId().equals(objId)) {
                acctNodesByUserName.put(k, node);
            }
        });

        acctNodesById.forEach((k, v) -> {
            if (v.getId().equals(objId)) {
                acctNodesById.put(k, node);
            }
        });
    }
}
