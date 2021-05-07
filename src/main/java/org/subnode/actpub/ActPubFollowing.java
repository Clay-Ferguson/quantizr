package org.subnode.actpub;

import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.service.NodeEditService;
import org.subnode.util.ThreadLocals;

@Component
public class ActPubFollowing {
    private static final Logger log = LoggerFactory.getLogger(ActPubFollowing.class);

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
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

    /*
     * outbound message to follow/unfollow users on remote servers
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
                APObj followAction = new APObj();

                // send follow action
                if (following) {
                    followAction //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("id", appProp.getProtocolHostAndPort() + "/follow/" + String.valueOf(new Date().getTime())) //
                            .put("type", "Follow") //
                            .put("actor", sessionActorUrl) //
                            .put("object", actorUrlOfUserBeingFollowed);
                }
                // send unfollow action
                else {
                    followAction //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("id", appProp.getProtocolHostAndPort() + "/unfollow/" + String.valueOf(new Date().getTime())) //
                            .put("type", "Undo") //
                            .put("actor", sessionActorUrl) //
                            .put("object", new APObj() //
                                    .put("id",
                                            appProp.getProtocolHostAndPort() + "/unfollow-obj/"
                                                    + String.valueOf(new Date().getTime())) //
                                    .put("type", "Follow") //
                                    .put("actor", sessionActorUrl) //
                                    .put("object", actorUrlOfUserBeingFollowed));
                }

                APObj toActor = apUtil.getActorByUrl(actorUrlOfUserBeingFollowed);
                String toInbox = AP.str(toActor, "inbox");
                apUtil.securePost(session, null, toInbox, sessionActorUrl, followAction);
                return null;
            });
        } catch (Exception e) {
            log.debug("Set following Failed.");
        }
    }

        /*
     * Process inbound 'Follow' actions (comming from foreign servers). This results in the follower an
     * account node in our local DB created if not already existing, and then a FRIEND node under his
     * FRIENDS_LIST created to represent the person he's following, if not already existing.
     * 
     * If 'unFollow' is true we actually do an unfollow instead of a follow.
     */
    public APObj processFollowAction(Object followAction, boolean unFollow) {

        return (APObj) adminRunner.run(session -> {
            // Actor URL of actor doing the following
            String followerActorUrl = AP.str(followAction, "actor");
            if (followerActorUrl == null) {
                log.debug("no 'actor' found on follows action request posted object");
                return null;
            }

            APObj followerActorObj = apUtil.getActorByUrl(followerActorUrl);

            // log.debug("getLongUserNameFromActorUrl: " + actorUrl + "\n" +
            // XString.prettyPrint(actor));
            String followerUserName = apUtil.getLongUserNameFromActor(followerActorObj);
            SubNode followerAccountNode = apService.loadForeignUserByUserName(session, followerUserName);
            apService.userEncountered(followerUserName, false);

            // Actor being followed (local to our server)
            String actorBeingFollowedUrl = AP.str(followAction, "object");
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
            SubNode followerFriendList = read.getUserNodeByType(session, followerUserName, null, null, NodeType.FRIEND_LIST.s(), null);

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
                    APObj acceptFollow = new APObj() //
                            .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                            .put("summary", "Accepted " + (unFollow ? "unfollow" : "follow") + " request") //
                            .put("type", "Accept") //
                            .put("actor", actorBeingFollowedUrl) //
                            .put("object", new APObj() //
                                    .put("type", unFollow ? "Undo" : "Follow") //
                                    .put("actor", followerActorUrl) //
                                    .put("object", actorBeingFollowedUrl)); //

                    String followerInbox = AP.str(followerActorObj, "inbox");

                    // log.debug("Sending Accept of Follow Request to inbox " + followerInbox);
                    apUtil.securePost(session, privateKey, followerInbox, actorBeingFollowedUrl, acceptFollow);
                } catch (Exception e) {
                }
            };
            executor.execute(runnable);
            return null;
        });
    }

    public APObj generateFollowers(String userName) {
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName;
        Long totalItems = getFollowersCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public APObj generateFollowing(String userName) {
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName;
        Long totalItems = getFollowingCount(userName);

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    public APObj generateFollowingPage(String userName, String minId) {
        List<String> following = getFollowing(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", following) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWING + "/" + userName)//
                .put("totalItems", following.size());
    }

    public List<String> getFollowers(String userName, String minId) {
        final List<String> followers = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = read.findFollowersOfUser(session, userName);

            for (SubNode n : iter) {
                // log.debug("Follower found: " + XString.prettyPrint(n));
                followers.add(n.getStrProp(NodeProp.ACT_PUB_ACTOR_URL));
            }
            return null;
        });

        return followers;
    }

    public List<String> getFollowing(String userName, String minId) {
        final List<String> following = new LinkedList<>();

        adminRunner.run(session -> {
            Iterable<SubNode> iter = read.findFollowingOfUser(session, userName);

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
            Long count = read.countFollowersOfUser(session, userName);
            return count;
        });
    }

    public Long getFollowingCount(String userName) {
        return (Long) adminRunner.run(session -> {
            Long count = read.countFollowingOfUser(session, userName);
            return count;
        });
    }

    public APObj generateFollowersPage(String userName, String minId) {
        List<String> followers = getFollowers(userName, minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName + "?page=true";
        if (minId != null) {
            url += "&min_id=" + minId;
        }
        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", followers) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_FOLLOWERS + "/" + userName)//
                .put("totalItems", followers.size());
    }
}
