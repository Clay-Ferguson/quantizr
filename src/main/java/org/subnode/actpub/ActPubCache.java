package org.subnode.actpub;

import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.subnode.actpub.model.APObj;
import org.subnode.mongo.model.SubNode;

@Component
public class ActPubCache {
    /*
     * Holds users for which messages need refreshing (false value) but sets value to 'true' once
     * completed
     */
    public final ConcurrentHashMap<String, Boolean> usersPendingRefresh = new ConcurrentHashMap<>();

    /* Cache Actor objects by UserName in memory only for now */
    public final ConcurrentHashMap<String, APObj> actorsByUserName = new ConcurrentHashMap<>();

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
}
