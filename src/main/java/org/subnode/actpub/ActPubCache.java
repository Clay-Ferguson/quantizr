package org.subnode.actpub;

import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.subnode.mongo.model.SubNode;

@Component
public class ActPubCache {
    /*
     * Holds users for which messages need refreshing (false value) but sets value to 'true' once
     * completed
     */
    public final ConcurrentHashMap<String, Boolean> usersPendingRefresh = new ConcurrentHashMap<>();

    /* Cache Actor objects by UserName in memory only for now */
    public final ConcurrentHashMap<String, APObj> actorCacheByUserName = new ConcurrentHashMap<>();

    /* Cache Actor objects by URL in memory only for now */
    public final ConcurrentHashMap<String, APObj> actorCacheByUrl = new ConcurrentHashMap<>();

    /* Cache of user account node Ids by actor url */
    public final ConcurrentHashMap<String, String> acctIdByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by actor Url */
    public final ConcurrentHashMap<String, SubNode> accountNodesByActorUrl = new ConcurrentHashMap<>();

    /* Account Node by User Name */
    public final ConcurrentHashMap<String, SubNode> accountNodesByUserName = new ConcurrentHashMap<>();

    /* Account Node by node ID */
    public final ConcurrentHashMap<String, SubNode> accountNodesById = new ConcurrentHashMap<>();
}
