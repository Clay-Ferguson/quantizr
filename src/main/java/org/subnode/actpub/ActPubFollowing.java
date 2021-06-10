package org.subnode.actpub;

import java.util.Date;
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
import org.subnode.actpub.model.APOAccept;
import org.subnode.actpub.model.APOFollow;
import org.subnode.actpub.model.APOOrderedCollection;
import org.subnode.actpub.model.APOOrderedCollectionPage;
import org.subnode.actpub.model.APOUndo;
import org.subnode.actpub.model.APObj;
import org.subnode.actpub.model.APProp;
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetFollowersRequest;
import org.subnode.request.GetFollowingRequest;
import org.subnode.response.GetFollowersResponse;
import org.subnode.response.GetFollowingResponse;
import org.subnode.service.NodeEditService;
import org.subnode.util.Const;
import org.subnode.util.Convert;
import org.subnode.util.ThreadLocals;

@Component
public class ActPubFollowing {
    private static final Logger log = LoggerFactory.getLogger(ActPubFollowing.class);

    @Autowired
    private MongoTemplate ops;

    @Autowired
    private ActPubUtil apUtil;

    @Autowired
    private RunAsMongoAdminEx adminRunner;

    @Autowired
    private AppProp appProp;

    @Autowired
    private ActPubService apService;

    @Autowired
    private MongoRead read;

    @Autowired
    private NodeEditService edit;

    @Autowired
    private MongoDelete delete;

    @Autowired
    private MongoUtil util;

    @Autowired
    private ActPubCrypto apCrypto;

    @Autowired
	private Convert convert;

    @Autowired
    private MongoAuth auth;

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    private Executor executor;

    /**
     * Outbound message to foreign servers to follow/unfollow users
     * 
     * apUserName is full user name like alice@quantizr.com
     */
    public void setFollowing(String followerUserName, String apUserName, boolean following) {
        try {
            // log.debug("Local Follower User: " + followerUserName + " setFollowing: " + apUserName + "
            // following=" + following);
            // admin doesn't follow/unfollow
            if (PrincipalName.ADMIN.s().equalsIgnoreCase(followerUserName)) {
                return;
            }

            APObj webFingerOfUserBeingFollowed = apUtil.getWebFinger(apUserName);
            String actorUrlOfUserBeingFollowed = apUtil.getActorUrlFromWebFingerObj(webFingerOfUserBeingFollowed);

            adminRunner.run(session -> {
                String sessionActorUrl = apUtil.makeActorUrlForUserName(followerUserName);
                APOFollow followAction = new APOFollow()
                        .put(APProp.id, appProp.getProtocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
                        .put(APProp.actor, sessionActorUrl) //
                        .put(APProp.object, actorUrlOfUserBeingFollowed);
                APObj action = null;

                // send follow action
                if (following) {
                    action = followAction;
                }
                // send unfollow action
                else {
                    action = new APOUndo()//
                            .put(APProp.id,
                                    appProp.getProtocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                            .put(APProp.actor, sessionActorUrl) //
                            .put(APProp.object, followAction);
                }

                APObj toActor = apUtil.getActorByUrl(actorUrlOfUserBeingFollowed);
                String toInbox = AP.str(toActor, APProp.inbox);
                apUtil.securePost(followerUserName, session, null, toInbox, sessionActorUrl, action, null);
                return null;
            });
        } catch (Exception e) {
            log.debug("Set following Failed.");
        }
    }

    /**
     * Process inbound 'Follow' actions (comming from foreign servers). This results in the follower an
     * account node in our local DB created if not already existing, and then a FRIEND node under his
     * FRIEND_LIST created to represent the person he's following, if not already existing.
     * 
     * If 'unFollow' is true we actually do an unfollow instead of a follow.
     */
    public void processFollowAction(Object followAction, boolean unFollow) {
        adminRunner.<APObj>run(session -> {
            // Actor URL of actor doing the following
            String followerActorUrl = AP.str(followAction, APProp.actor);
            if (followerActorUrl == null) {
                log.debug("no 'actor' found on follows action request posted object");
                return null;
            }

            /* Protocol says we need to send this acceptance back */
            Runnable runnable = () -> {
                try {
                    APObj followerActor = apUtil.getActorByUrl(followerActorUrl);
                    String followerActorHtmlUrl = AP.str(followerActor, APProp.url);

                    // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
                    // XString.prettyPrint(actor));
                    String followerUserName = apUtil.getLongUserNameFromActor(followerActor);
                    SubNode followerAccountNode = apService.getAcctNodeByUserName(session, followerUserName);
                    apService.userEncountered(followerUserName, false);

                    // Actor being followed (local to our server)
                    String actorBeingFollowedUrl = AP.str(followAction, APProp.object);
                    if (actorBeingFollowedUrl == null) {
                        log.debug("no 'object' found on follows action request posted object");
                        return;
                    }

                    String userToFollow = apUtil.getLocalUserNameFromActorUrl(actorBeingFollowedUrl);
                    if (userToFollow == null) {
                        log.debug("unable to get a user name from actor url: " + actorBeingFollowedUrl);
                        return;
                    }

                    // get the Friend List of the follower
                    SubNode followerFriendList = read.getUserNodeByType(session, followerUserName, null, null,
                            NodeType.FRIEND_LIST.s(), null, NodeName.FRIENDS);

                    /*
                     * lookup to see if this followerFriendList node already has userToFollow already under it
                     */
                    SubNode friendNode =
                            read.findNodeByUserAndType(session, followerFriendList, userToFollow, NodeType.FRIEND.s());
                    if (friendNode == null) {
                        if (!unFollow) {
                            friendNode = edit.createFriendNode(session, followerFriendList, userToFollow, followerActorUrl,
                                    followerActorHtmlUrl);
                            // userFeedService.sendServerPushInfo(localUserName,
                            // new NotificationMessage("apReply", null, contentHtml, toUserName));
                        }
                    } else {
                        // if this is an unfollow delete the friend node
                        if (unFollow) {
                            delete.deleteNode(session, friendNode, false);
                        }
                    }

                    String privateKey = apCrypto.getPrivateKey(session, userToFollow);

                    // todo-1: what's this sleep doing? I'm pretty sure I just wanted to give the caller (i.e. the
                    // remote Fedi instance) a chance to get a return code back for this call before posting
                    // back to it
                    Thread.sleep(2000);

                    // Must send either Accept or Reject. Currently we auto-accept all.
                    APObj acceptPayload = unFollow ? new APOUndo() : new APOFollow();
                    acceptPayload.put(APProp.actor, followerActorUrl) //
                            .put(APProp.object, actorBeingFollowedUrl);

                    APOAccept accept = new APOAccept() //
                            .put(APProp.summary, "Accepted " + (unFollow ? "unfollow" : "follow") + " request") //
                            .put(APProp.actor, actorBeingFollowedUrl) //
                            .put(APProp.object, acceptPayload); //

                    String followerInbox = AP.str(followerActor, APProp.inbox);

                    // log.debug("Sending Accept of Follow Request to inbox " + followerInbox);
                    String userDoingPost = ThreadLocals.getSessionContext().getUserName();
                    apUtil.securePost(userDoingPost, session, privateKey, followerInbox, actorBeingFollowedUrl, accept, null);
                } catch (Exception e) {
                }
            };
            executor.execute(runnable);
            return null;
        });
    }

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

    /**
     * Generates outbound following data
     */
    public APOOrderedCollection generateFollowing(String userName) {
        String url = appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName;
        Long totalItems = getFollowingCount(userName);

        APOOrderedCollection ret = new APOOrderedCollection() //
                .put(APProp.id, url) //
                .put(APProp.totalItems, totalItems) //
                .put(APProp.first, url + "?page=true") //
                .put(APProp.last, url + "?min_id=0&page=true");
        return ret;
    }

    /**
     * Generates one page of results for the outbound 'following' request
     */
    public APOOrderedCollectionPage generateFollowingPage(String userName, String minId) {
        List<String> following = getFollowing(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        APOOrderedCollectionPage ret = new APOOrderedCollectionPage() //
                .put(APProp.id, url) //
                .put(APProp.orderedItems, following) //
                .put(APProp.partOf, appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName)//
                .put(APProp.totalItems, following.size());
        return ret;
    }

    /**
     * Returns a list of all the 'actor urls' for all the users that are following user 'userName'
     */
    public List<String> getFollowers(String userName, String minId) {
        final List<String> followers = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = findFollowersOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_ID));
            }
            return null;
        });

        return followers;
    }

    /**
     * Returns a list of all the 'actor urls' for all the users that 'userName' is following
     */
    public List<String> getFollowing(String userName, String minId) {
        final List<String> following = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = findFollowingOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                following.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_ID));
            }
            return null;
        });

        return following;
    }

    public Long getFollowersCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = countFollowersOfUser(session, userName);
            return count;
        });
    }

    public Long getFollowingCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = countFollowingOfUser(session, userName);
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

    // =========================================================================
    // Followers Query
    // =========================================================================

    public Iterable<SubNode> findFollowersOfUser(MongoSession session, String userName) {
        Query query = followersOfUser_query(session, userName);
        if (query == null)
            return null;
        return util.find(query);
    }

    // todo-1: review how do functions like this recieves the admin session?
    public GetFollowersResponse getFollowers(MongoSession session, GetFollowersRequest req) {
        GetFollowersResponse res = new GetFollowersResponse();
        if (session == null) {
            session = ThreadLocals.getMongoSession();
        }

        MongoSession adminSession = auth.getAdminSession();
        Query query = followersOfUser_query(adminSession, req.getTargetUserName());
        if (query == null)
            return null;

        query.limit(Const.ROWS_PER_PAGE);
        query.skip(Const.ROWS_PER_PAGE * req.getPage());

        Iterable<SubNode> iterable = util.find(query);
        List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
        int counter = 0;

        for (SubNode node : iterable) {
            NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), adminSession, node, true, false, counter + 1,
                    false, false);
            searchResults.add(info);
        }

        res.setSearchResults(searchResults);
        return res;
    }

    public GetFollowingResponse getFollowing(MongoSession session, GetFollowingRequest req) {
        GetFollowingResponse res = new GetFollowingResponse();
        if (session == null) {
            session = ThreadLocals.getMongoSession();
        }

        MongoSession adminSession = auth.getAdminSession();
        Query query = findFollowingOfUser_query(adminSession, req.getTargetUserName());
        if (query == null)
            return null;

        query.limit(Const.ROWS_PER_PAGE);
        query.skip(Const.ROWS_PER_PAGE * req.getPage());

        Iterable<SubNode> iterable = util.find(query);
        List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
        int counter = 0;

        for (SubNode node : iterable) {
            NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), adminSession, node, true, false, counter + 1,
                    false, false);
            searchResults.add(info);
        }

        res.setSearchResults(searchResults);
        return res;
    }

    public long countFollowersOfUser(MongoSession session, String userName) {
        Query query = followersOfUser_query(session, userName);
        if (query == null)
            return 0L;
        return ops.count(query, SubNode.class);
    }

    public Query followersOfUser_query(MongoSession session, String userName) {
        Query query = new Query();

        Criteria criteria =
                Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(NodeName.ROOT_OF_ALL_USERS)) //
                        .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER.s() + ".value").is(userName) //
                        .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }

    // =========================================================================
    // Following Query
    // =========================================================================

    /* Returns FRIEND nodes for every user 'userName' is following */
    public Iterable<SubNode> findFollowingOfUser(MongoSession session, String userName) {
        Query query = findFollowingOfUser_query(session, userName);
        if (query == null)
            return null;

        return util.find(query);
    }

    public long countFollowingOfUser(MongoSession session, String userName) {
        Query query = findFollowingOfUser_query(session, userName);
        if (query == null)
            return 0;

        return ops.count(query, SubNode.class);
    }

    private Query findFollowingOfUser_query(MongoSession session, String userName) {
        Query query = new Query();

        // get friends list node
        SubNode friendsListNode =
                read.getUserNodeByType(session, userName, null, null, NodeType.FRIEND_LIST.s(), null, NodeName.FRIENDS);
        if (friendsListNode == null)
            return null;

        // query all the friends under
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH) //
                .regex(util.regexRecursiveChildrenOfPath(friendsListNode.getPath())) //
                .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }
}
