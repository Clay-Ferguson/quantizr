package org.subnode.actpub;

import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import org.subnode.actpub.model.AP;
import org.subnode.actpub.model.APOOrderedCollection;
import org.subnode.actpub.model.APOOrderedCollectionPage;
import org.subnode.actpub.model.APObj;
import org.subnode.actpub.model.APProp;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.ConstantInt;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoThreadLocal;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetFollowersRequest;
import org.subnode.response.GetFollowersResponse;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;

@Component
public class ActPubFollower {
    private static final Logger log = LoggerFactory.getLogger(ActPubFollower.class);

    @Autowired
    private MongoTemplate ops;

    @Autowired
    private AdminRun arun;

    @Autowired
    private AppProp appProp;

    @Autowired
    private MongoUtil util;

    @Autowired
    private Convert convert;

    @Autowired
    private MongoAuth auth;

    @Autowired
    private ActPubService apService;

    @Autowired
    private ActPubUtil apUtil;

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    private Executor executor;

    /**
     * Generates outbound followers data
     */
    public APOOrderedCollection generateFollowers(String userName) {
        String url = appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWERS + "/" + userName;
        Long totalItems = getFollowersCount(userName);

        APOOrderedCollection ret = new APOOrderedCollection() //
                .put(APProp.id, url) //
                .put(APProp.totalItems, totalItems) //
                .put(APProp.first, url + "?page=true") //
                .put(APProp.last, url + "?min_id=0&page=true");
        return ret;
    }

    /* Calls saveFediverseName for each person who is a 'follower' of actor */
    public int loadRemoteFollowers(MongoSession ms, APObj actor) {

        String followersUrl = (String) AP.str(actor, APProp.followers);
        APObj followers = getFollowers(followersUrl);
        if (followers == null) {
            log.debug("Unable to get followers for AP user: " + followersUrl);
            return 0;
        }

        int ret = AP.integer(followers, APProp.totalItems);

        apUtil.iterateOrderedCollection(followers, Integer.MAX_VALUE, obj -> {
            try {
                // if (obj != null) {
                // log.debug("follower: OBJ=" + XString.prettyPrint(obj));
                // }

                if (obj instanceof String) {
                    String followerActorUrl = (String) obj;

                    // for now just add the url for future crawling. todo-1: later we can do something more meaningful
                    // with each actor url.
                    if (apService.saveFediverseName(followerActorUrl)) {
                        // log.debug("follower: " + followerActorUrl);
                    }
                } else {
                    log.debug("Unexpected follower item class: " + obj.getClass().getName());
                }

            } catch (Exception e) {
                log.error("Failed processing collection item.", e);
            }
            // always iterate all.
            return true;
        });
        return ret;
    }

    public APObj getFollowers(String url) {
        if (url == null)
            return null;

        APObj outbox = apUtil.getJson(url, APConst.MT_APP_ACTJSON);
        // ActPubService.outboxQueryCount++;
        // ActPubService.cycleOutboxQueryCount++;
        apUtil.log("Followers: " + XString.prettyPrint(outbox));
        return outbox;
    }

    /**
     * Returns followers for LOCAL users only following 'userName'. This doesn't use ActPub or query any
     * remote servers
     * 
     * Returns a list of all the 'actor urls' for all the users that are following user 'userName'
     */
    public List<String> getFollowers(String userName, String minId) {
        final List<String> followers = new LinkedList<>();

        arun.run(session -> {
            Iterable<SubNode> iter = getFriendsByUserName(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_ID));
            }
            return null;
        });

        return followers;
    }

    public Long getFollowersCount(String userName) {
        return (Long) arun.run(session -> {
            Long count = countFollowersOfUser(session, userName, null);
            return count;
        });
    }

    public APOOrderedCollectionPage generateFollowersPage(String userName, String minId) {
        List<String> followers = getFollowers(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWERS + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        APOOrderedCollectionPage ret = new APOOrderedCollectionPage() //
                .put(APProp.id, url) //
                .put(APProp.orderedItems, followers) //
                .put(APProp.partOf, appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWERS + "/" + userName)//
                .put(APProp.totalItems, followers.size());
        return ret;
    }

    public Iterable<SubNode> getFriendsByUserName(MongoSession ms, String userName) {
        Query query = getFriendsByUserName_query(ms, userName);
        if (query == null)
            return null;
        return util.find(query);
    }

    // todo-1: review how do functions like this recieves the admin session?
    public GetFollowersResponse getFollowers(MongoSession ms, GetFollowersRequest req) {
        GetFollowersResponse res = new GetFollowersResponse();
        ms = MongoThreadLocal.ensure(ms);

        MongoSession adminSession = auth.getAdminSession();
        Query query = getFriendsByUserName_query(adminSession, req.getTargetUserName());
        if (query == null)
            return null;

        query.limit(ConstantInt.ROWS_PER_PAGE.val());
        query.skip(ConstantInt.ROWS_PER_PAGE.val() * req.getPage());

        Iterable<SubNode> iterable = util.find(query);
        List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
        int counter = 0;

        for (SubNode node : iterable) {
            NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), adminSession, node, true, false,
                    counter + 1, false, false, false, true);
            searchResults.add(info);
        }

        res.setSearchResults(searchResults);
        return res;
    }

    public long countFollowersOfUser(MongoSession ms, String userName, String actorUrl) {
        // if local user
        if (userName.indexOf("@") == -1) {
            return countFollowersOfLocalUser(ms, userName);
        }
        // if foreign user
        else {
            /* Starting with just actorUrl, lookup the follower count */
            int ret = 0;
            if (actorUrl != null) {
                APObj actor = apUtil.getActorByUrl(actorUrl);
                if (actor != null) {
                    String followersUrl = (String) AP.str(actor, APProp.followers);
                    APObj followers = getFollowers(followersUrl);
                    if (followers == null) {
                        log.debug("Unable to get followers for AP user: " + followersUrl);
                    }
                    ret = AP.integer(followers, APProp.totalItems);
                }
            }
            return ret;
        }
    }

    public long countFollowersOfLocalUser(MongoSession ms, String userName) {
        Query query = getFriendsByUserName_query(ms, userName);
        if (query == null)
            return 0L;
        return ops.count(query, SubNode.class);
    }

    public Query getFriendsByUserName_query(MongoSession ms, String userName) {
        Query query = new Query();
        Criteria criteria =
                Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(NodeName.ROOT_OF_ALL_USERS)) //
                        .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER.s() + ".value").is(userName) //
                        .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }
}
