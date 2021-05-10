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
import org.subnode.config.AppProp;
import org.subnode.config.NodeName;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.NodeEditService;
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
    @Qualifier("threadPoolTaskExecutor")
    private Executor executor;

    /**
     * Outbound message to foreign servers to follow/unfollow users
     * 
     * apUserName is full user name like alice@quantizr.com
     */
    public void setFollowing(String apUserName, boolean following) {
        try {
            // admin doesn't follow/unfollow
            if (ThreadLocals.getSessionContext().isAdmin()) {
                return;
            }

            APObj webFingerOfUserBeingFollowed = apUtil.getWebFinger(apUserName);
            String actorUrlOfUserBeingFollowed = apUtil.getActorUrlFromWebFingerObj(webFingerOfUserBeingFollowed);

            adminRunner.run(session -> {
                String sessionActorUrl = apUtil.makeActorUrlForUserName(ThreadLocals.getSessionContext().getUserName());
                APObj followAction = null;

                // send follow action
                if (following) {
                    followAction = new APOFollow();
                    followAction //
                            .put(AP.id, appProp.getProtocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
                            .put(AP.actor, sessionActorUrl) //
                            .put(AP.object, actorUrlOfUserBeingFollowed);
                }
                // send unfollow action
                else {
                    followAction = new APOUndo();
                    followAction //
                            .put(AP.id, appProp.getProtocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                            .put(AP.actor, sessionActorUrl) //
                            .put(AP.object, new APObj() //
                                    // todo-0: need to verify this undo object should have the @context property before adding it.
                                    // and only way will be to test against Mastodon again.
                                    .put(AP.id,
                                            // todo-0: check this. Shouldn't this be /follow/ instead of /unfollow-pbj/ ?
                                            appProp.getProtocolHostAndPort() + "/unfollow-obj/"
                                                    + String.valueOf(new Date().getTime())) //
                                    .put(AP.type, APType.Follow) //
                                    .put(AP.actor, sessionActorUrl) //
                                    .put(AP.object, actorUrlOfUserBeingFollowed));
                }

                APObj toActor = apUtil.getActorByUrl(actorUrlOfUserBeingFollowed);
                String toInbox = AP.str(toActor, AP.inbox);
                apUtil.securePost(session, null, toInbox, sessionActorUrl, followAction);
                return null;
            });
        } catch (Exception e) {
            log.debug("Set following Failed.");
        }
    }

    /**
     * Process inbound 'Follow' actions (comming from foreign servers). This results in the follower an
     * account node in our local DB created if not already existing, and then a FRIEND node under his
     * FRIENDS_LIST created to represent the person he's following, if not already existing.
     * 
     * If 'unFollow' is true we actually do an unfollow instead of a follow.
     */
    public APObj processFollowAction(Object followAction, boolean unFollow) {

        return (APObj) adminRunner.run(session -> {
            // Actor URL of actor doing the following
            String followerActorUrl = AP.str(followAction, AP.actor);
            if (followerActorUrl == null) {
                log.debug("no 'actor' found on follows action request posted object");
                return null;
            }

            APObj followerActorObj = apUtil.getActorByUrl(followerActorUrl);

            // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
            // XString.prettyPrint(actor));
            String followerUserName = apUtil.getLongUserNameFromActor(followerActorObj);
            SubNode followerAccountNode = apService.getAcctNodeByUserName(session, followerUserName);
            apService.userEncountered(followerUserName, false);

            // Actor being followed (local to our server)
            String actorBeingFollowedUrl = AP.str(followAction, AP.object);
            if (actorBeingFollowedUrl == null) {
                log.debug("no 'object' found on follows action request posted object");
                return null;
            }

            String userToFollow = apUtil.getLocalUserNameFromActorUrl(actorBeingFollowedUrl);
            if (userToFollow == null) {
                log.debug("unable to get a user name from actor url: " + actorBeingFollowedUrl);
                return null;
            }

            // get the Friend List of the follower
            SubNode followerFriendList =
                    read.getUserNodeByType(session, followerUserName, null, null, NodeType.FRIEND_LIST.s(), null);

            /*
             * lookup to see if this followerFriendList node already has userToFollow already under it
             */
            SubNode friendNode = read.findFriendOfUser(session, followerFriendList, userToFollow);
            if (friendNode == null) {
                if (!unFollow) {
                    friendNode = edit.createFriendNode(session, followerFriendList, userToFollow, followerActorUrl);
                    // userFeedService.sendServerPushInfo(localUserName,
                    // new NotificationMessage("apReply", null, contentHtml, toUserName));
                }
            } else {
                // if this is an unfollow delete the friend node
                if (unFollow) {
                    delete.deleteNode(session, friendNode, false);
                }
            }

            String privateKey = apUtil.getPrivateKey(session, userToFollow);

            /* Protocol says we need to send this acceptance back */
            Runnable runnable = () -> {
                try {
                    // todo-1: what's this sleep doing? I'm pretty sure I just wanted to give the caller (i.e. the
                    // remote Fedi instance) a chance to get a return code back for this call before posting
                    // back to it
                    Thread.sleep(2000);

                    // Must send either Accept or Reject. Currently we auto-accept all.
                    APOAccept acceptFollow = new APOAccept();
                    acceptFollow.put(AP.summary, "Accepted " + (unFollow ? "unfollow" : "follow") + " request") //
                            .put(AP.actor, actorBeingFollowedUrl) //
                            // todo-0: need to verify this undo object should have the @context property before adding it.
                            // and only way will be to test against Mastodon again.
                            .put(AP.object, new APObj() //
                                    .put(AP.type, unFollow ? APType.Undo : APType.Follow) //
                                    .put(AP.actor, followerActorUrl) //
                                    .put(AP.object, actorBeingFollowedUrl)); //

                    String followerInbox = AP.str(followerActorObj, AP.inbox);

                    // log.debug("Sending Accept of Follow Request to inbox " + followerInbox);
                    apUtil.securePost(session, privateKey, followerInbox, actorBeingFollowedUrl, acceptFollow);
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

        APOOrderedCollection ret = new APOOrderedCollection();
        ret.put(AP.id, url) //
                .put(AP.totalItems, totalItems) //
                .put(AP.first, url + "?page=true") //
                .put(AP.last, url + "?min_id=0&page=true");
        return ret;
    }

    /**
     * Generates outbound following data
     */
    public APOOrderedCollection generateFollowing(String userName) {
        String url = appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName;
        Long totalItems = getFollowingCount(userName);

        APOOrderedCollection ret = new APOOrderedCollection();
        ret.put(AP.id, url) //
                .put(AP.totalItems, totalItems) //
                .put(AP.first, url + "?page=true") //
                .put(AP.last, url + "?min_id=0&page=true");
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
        APOOrderedCollectionPage ret = new APOOrderedCollectionPage();
        ret.put(AP.id, url) //
                .put(AP.orderedItems, following) //
                .put(AP.partOf, appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName)//
                .put(AP.totalItems, following.size());
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
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
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
                following.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
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
        APOOrderedCollectionPage ret = new APOOrderedCollectionPage();
        ret.put(AP.id, url) //
                .put(AP.orderedItems, followers) //
                .put(AP.partOf, appProp.getProtocolHostAndPort() + APConst.PATH_FOLLOWERS + "/" + userName)//
                .put(AP.totalItems, followers.size());
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
                        .and(SubNode.FIELD_PROPERTIES + "." + NodeProp.USER.s()).is(userName) //
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
        SubNode friendsListNode = read.getUserNodeByType(session, userName, null, null, NodeType.FRIEND_LIST.s(), null);
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
