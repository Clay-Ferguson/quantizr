package org.subnode.actpub;

import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
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
import org.subnode.config.NodeName;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.ConstantInt;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrincipalName;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetFollowingRequest;
import org.subnode.response.GetFollowingResponse;
import org.subnode.service.ServiceBase;
import org.subnode.util.ThreadLocals;
import org.subnode.util.XString;
import static org.subnode.util.Util.*;

@Component
public class ActPubFollowing extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubFollowing.class);

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
            apUtil.log("Local Follower User (person doing the): " + followerUserName + " setFollowing: " + apUserName
                    + "following=" + following);
            // admin doesn't follow/unfollow
            if (PrincipalName.ADMIN.s().equalsIgnoreCase(followerUserName)) {
                return;
            }

            APObj webFingerOfUserBeingFollowed = apUtil.getWebFinger(apUserName);
            String actorUrlOfUserBeingFollowed = apUtil.getActorUrlFromWebFingerObj(webFingerOfUserBeingFollowed);

            arun.run(session -> {
                String sessionActorUrl = apUtil.makeActorUrlForUserName(followerUserName);
                APOFollow followAction = new APOFollow()
                        .put(APProp.id, prop.getProtocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
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
                            .put(APProp.id, prop.getProtocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                            .put(APProp.actor, sessionActorUrl) //
                            .put(APProp.object, followAction);
                }

                APObj toActor = apUtil.getActorByUrl(actorUrlOfUserBeingFollowed);
                if (ok(toActor)) {
                    String toInbox = AP.str(toActor, APProp.inbox);
                    apUtil.securePost(followerUserName, session, null, toInbox, sessionActorUrl, action, null);
                } else {
                    apUtil.log("Unable to get actor to post to: " + actorUrlOfUserBeingFollowed);
                }
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

        // Actor URL of actor doing the following
        String followerActorUrl = AP.str(followAction, APProp.actor);
        if (no(followerActorUrl)) {
            log.debug("no 'actor' found on follows action request posted object");
            return;
        }

        Runnable runnable = () -> {
            arun.<APObj>run(session -> {
                try {
                    APObj followerActor = apUtil.getActorByUrl(followerActorUrl);
                    if (no(followerActor)) {
                        return null;
                    }

                    log.debug("getLongUserNameFromActorUrl: " + followerActor + "\n" + XString.prettyPrint(followerActor));
                    String followerUserName = apUtil.getLongUserNameFromActor(followerActor);

                    // this will lookup the user AND import it it's a non-existant user
                    SubNode followerAccountNode = apub.getAcctNodeByUserName(session, followerUserName);
                    if (no(followerAccountNode)) {
                        throw new RuntimeException("Unable to get or import user: " + followerUserName);
                    }

                    apub.userEncountered(followerUserName, false);

                    // Actor being followed (local to our server)
                    String actorBeingFollowedUrl = AP.str(followAction, APProp.object);
                    if (no(actorBeingFollowedUrl)) {
                        log.debug("no 'object' found on follows action request posted object");
                        return null;
                    }

                    String userToFollow = apUtil.getLocalUserNameFromActorUrl(actorBeingFollowedUrl);
                    if (no(userToFollow)) {
                        log.debug("unable to get a user name from actor url: " + actorBeingFollowedUrl);
                        return null;
                    }

                    // get the Friend List of the follower
                    SubNode followerFriendList = read.getUserNodeByType(session, followerUserName, null, null,
                            NodeType.FRIEND_LIST.s(), null, NodeName.FRIENDS);

                    /*
                     * lookup to see if this followerFriendList node already has userToFollow already under it
                     */
                    SubNode friendNode =
                            read.findNodeByUserAndType(session, followerFriendList, userToFollow, NodeType.FRIEND.s());

                    if (no(friendNode)) {
                        if (!unFollow) {
                            apUtil.log("unable to find user node by name: " + followerUserName + " so creating.");
                            friendNode = edit.createFriendNode(session, followerFriendList, userToFollow);
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

                    log.debug("Sending Accept of Follow Request to inbox " + followerInbox);

                    apUtil.securePost(null, session, privateKey, followerInbox, actorBeingFollowedUrl, accept, null);
                } catch (Exception e) {
                    log.error("Failed sending follow reply.", e);
                }
                return null;
            });
        };
        executor.execute(runnable);
    }

    /**
     * Generates outbound following data
     */
    public APOOrderedCollection generateFollowing(String userName) {
        String url = prop.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName;
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
        String url = prop.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName + "?page=true";
        if (ok(minId)) {
            url += "&min_id=" + minId;
        }
        APOOrderedCollectionPage ret = new APOOrderedCollectionPage() //
                .put(APProp.id, url) //
                .put(APProp.orderedItems, following) //
                .put(APProp.partOf, prop.getProtocolHostAndPort() + APConst.PATH_FOLLOWING + "/" + userName)//
                .put(APProp.totalItems, following.size());
        return ret;
    }

    /* Calls saveFediverseName for each person who is a 'follower' of actor */
    public int loadRemoteFollowing(MongoSession ms, APObj actor) {

        String followingUrl = (String) AP.str(actor, APProp.following);
        APObj followings = getFollowing(followingUrl);
        if (no(followings)) {
            log.debug("Unable to get followings for AP user: " + followingUrl);
            return 0;
        }

        int ret = AP.integer(followings, APProp.totalItems);

        apUtil.iterateOrderedCollection(followings, Integer.MAX_VALUE, obj -> {
            try {
                // if (ok(obj )) {
                // log.debug("follower: OBJ=" + XString.prettyPrint(obj));
                // }

                if (obj instanceof String) {
                    String followingActorUrl = (String) obj;

                    // for now just add the url for future crawling. todo-1: later we can do something more meaningful
                    // with each actor url.
                    if (apub.saveFediverseName(followingActorUrl)) {
                        // log.debug("following: " + followingActorUrl);
                    }
                } else {
                    log.debug("Unexpected following item class: " + obj.getClass().getName());
                }

            } catch (Exception e) {
                log.error("Failed processing collection item.", e);
            }
            // always iterate all.
            return true;
        });
        return ret;
    }

    public APObj getFollowing(String url) {
        if (no(url))
            return null;

        APObj outbox = apUtil.getJson(url, APConst.MTYPE_ACT_JSON);
        // ActPubService.outboxQueryCount++;
        // ActPubService.cycleOutboxQueryCount++;
        apUtil.log("Following: " + XString.prettyPrint(outbox));
        return outbox;
    }

    /**
     * Returns following for LOCAL users only 'userName'. This doesn't use ActPub or query any remote
     * servers
     * 
     * Returns a list of all the 'actor urls' for all the users that 'userName' is following
     */
    public List<String> getFollowing(String userName, String minId) {
        final List<String> following = new LinkedList<>();

        arun.run(session -> {
            Iterable<SubNode> iter = findFollowingOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                following.add(n.getStr(NodeProp.ACT_PUB_ACTOR_ID));
            }
            return null;
        });

        return following;
    }

    public Long getFollowingCount(String userName) {
        return (Long) arun.run(session -> {
            Long count = countFollowingOfUser(session, userName, null);
            return count;
        });
    }

    public GetFollowingResponse getFollowing(MongoSession ms, GetFollowingRequest req) {
        GetFollowingResponse res = new GetFollowingResponse();
        ms = ThreadLocals.ensure(ms);

        MongoSession as = auth.getAdminSession();
        Query query = findFollowingOfUser_query(as, req.getTargetUserName());
        if (no(query))
            return null;

        query.limit(ConstantInt.ROWS_PER_PAGE.val());
        query.skip(ConstantInt.ROWS_PER_PAGE.val() * req.getPage());

        Iterable<SubNode> iterable = mongoUtil.find(query);
        List<NodeInfo> searchResults = new LinkedList<>();
        int counter = 0;

        for (SubNode node : iterable) {
            NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), as, node, true, false, counter + 1, false, false,
                    false, false);
            searchResults.add(info);
        }

        res.setSearchResults(searchResults);
        return res;
    }

    /* Returns FRIEND nodes for every user 'userName' is following */
    public Iterable<SubNode> findFollowingOfUser(MongoSession ms, String userName) {
        Query query = findFollowingOfUser_query(ms, userName);
        if (no(query))
            return null;

        return mongoUtil.find(query);
    }

    public long countFollowingOfUser(MongoSession ms, String userName, String actorUrl) {
        // if local user
        if (userName.indexOf("@") == -1) {
            return countFollowingOfLocalUser(ms, userName);
        }
        // if foreign user
        else {
            /* Starting with just actorUrl, lookup the following count */
            int ret = 0;
            if (ok(actorUrl)) {
                APObj actor = apUtil.getActorByUrl(actorUrl);
                if (ok(actor)) {
                    String followingUrl = (String) AP.str(actor, APProp.following);
                    APObj following = getFollowing(followingUrl);
                    if (no(following)) {
                        log.debug("Unable to get followers for AP user: " + followingUrl);
                    }
                    ret = AP.integer(following, APProp.totalItems);
                }
            }
            return ret;
        }
    }

    public long countFollowingOfLocalUser(MongoSession ms, String userName) {
        Query query = findFollowingOfUser_query(ms, userName);
        if (no(query))
            return 0;

        return ops.count(query, SubNode.class);
    }

    private Query findFollowingOfUser_query(MongoSession ms, String userName) {
        Query query = new Query();

        // get friends list node
        SubNode friendsListNode =
                read.getUserNodeByType(ms, userName, null, null, NodeType.FRIEND_LIST.s(), null, NodeName.FRIENDS);
        if (no(friendsListNode))
            return null;

        // query all the friends under
        Criteria criteria = Criteria.where(SubNode.FIELD_PATH) //
                .regex(mongoUtil.regexRecursiveChildrenOfPath(friendsListNode.getPath())) //
                .and(SubNode.FIELD_TYPE).is(NodeType.FRIEND.s());

        query.addCriteria(criteria);
        return query;
    }
}
