package quanta.service;

import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.CreateNodeLocation;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.request.AddFriendRequest;
import quanta.request.UpdateFriendNodeRequest;
import quanta.response.AddFriendResponse;
import quanta.response.DeleteFriendResponse;
import quanta.response.FriendInfo;
import quanta.response.UpdateFriendNodeResponse;
import quanta.util.ThreadLocals;
import quanta.util.XString;
import quanta.util.val.Val;

@Component
public class FriendService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(FriendService.class);

    public SubNode createFriendNode(MongoSession ms, SubNode parentFriendsList, String userToFollow, String tags) {
        // get userNode of user to follow
        SubNode userNode = read.getAccountByUserName(ms, userToFollow, false);
        if (userNode != null) {
            List<PropertyInfo> properties = new LinkedList<>();
            properties.add(new PropertyInfo(NodeProp.USER.s(), userToFollow));
            properties.add(new PropertyInfo(NodeProp.USER_NODE_ID.s(), userNode.getIdStr()));
            String userImgUrl = userNode.getStr(NodeProp.USER_ICON_URL);
            if (!StringUtils.isEmpty(userImgUrl)) {
                properties.add(new PropertyInfo(NodeProp.USER_ICON_URL.s(), userImgUrl));
            }
            SubNode friendNode = create.createNode(ms, parentFriendsList, null, NodeType.FRIEND.s(), 0L,
                    CreateNodeLocation.LAST, properties, parentFriendsList.getOwner(), true, true);
            friendNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));

            if (tags != null) {
                friendNode.setTags(tags);
            }

            String userToFollowActorId = userNode.getStr(NodeProp.ACT_PUB_ACTOR_ID);
            if (userToFollowActorId != null) {
                friendNode.set(NodeProp.ACT_PUB_ACTOR_ID, userToFollowActorId);
            }
            String userToFollowActorUrl = userNode.getStr(NodeProp.ACT_PUB_ACTOR_URL);
            if (userToFollowActorUrl != null) {
                friendNode.set(NodeProp.ACT_PUB_ACTOR_URL, userToFollowActorUrl);
            }
            update.save(ms, friendNode);
            return friendNode;
        } else {
            throw new RuntimeException("User not found: " + userToFollow);
        }
    }

    public UpdateFriendNodeResponse updateFriendNode(MongoSession ms, UpdateFriendNodeRequest req) {
        UpdateFriendNodeResponse res = new UpdateFriendNodeResponse();
        SubNode node = read.getNode(ms, req.getNodeId());
        auth.ownerAuth(ms, node);
        if (!NodeType.FRIEND.s().equals(node.getType())) {
            throw new RuntimeException("Not a Friend node.");
        }
        node.setTags(req.getTags());
        return res;
    }

    /*
     * Whenever a friend node is saved, we send the "following" request to the foreign ActivityPub
     * server
     */
    public void updateSavedFriendNode(String userDoingAction, SubNode node) {
        String userNodeId = node.getStr(NodeProp.USER_NODE_ID);
        String friendUserName = node.getStr(NodeProp.USER);
        if (friendUserName != null) {
            // if a foreign user, update thru ActivityPub.
            if (friendUserName.contains("@")) {
                log.trace("calling setFollowing=true, to post follow to foreign server.");
                apFollowing.setFollowing(userDoingAction, friendUserName, true);
            }
            /*
             * when user first adds, this friendNode won't have the userNodeId yet, so add if not yet existing
             */
            if (userNodeId == null) {
                /*
                 * A userName containing "@" is considered a foreign Fediverse user and will trigger a WebFinger
                 * search of them, and a load/update of their outbox
                 */
                if (friendUserName.contains("@")) {
                    exec.run(() -> {
                        arun.run(s -> {
                            if (!ThreadLocals.getSC().isAdmin()) {
                                apub.getAcctNodeByForeignUserName(s, userDoingAction, friendUserName, false, true);
                            }
                            /*
                             * The only time we pass true to load the user into the system is when they're being added
                             * as a friend.
                             */
                            apub.userEncountered(friendUserName, true);
                            return null;
                        });
                    });
                }
                Val<SubNode> userNode = new Val<SubNode>();

                userNode.setVal(read.getAccountByUserName(null, friendUserName, false));

                if (userNode.getVal() != null) {
                    userNodeId = userNode.getVal().getIdStr();
                    node.set(NodeProp.USER_NODE_ID, userNodeId);
                }
            }
        }
    }

    public DeleteFriendResponse deleteFriend(MongoSession ms, String delUserNodeId, String parentType) {
        DeleteFriendResponse res = new DeleteFriendResponse();
        ms = ThreadLocals.ensure(ms);
        Criteria crit = Criteria.where(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(delUserNodeId); //
        List<SubNode> friendNodes = user.getSpecialNodesList(ms, null, parentType, null, false, crit);
        if (friendNodes != null) {
            // we run a for loop but there will only be only up to one friend node in this result set.
            for (SubNode friendNode : friendNodes) {
                // we delete with updateHasChildren=false, because it's more efficient
                delete.delete(ms, friendNode, false);
            }
        }
        return res;
    }

    /*
     * Adds 'req.userName' as a friend by creating a FRIEND node under the current user's FRIENDS_LIST
     * if the user wasn't already a friend
     */
    public String addFriend(MongoSession ms, String userDoingFollow, ObjectId accntIdDoingFollow,
            String userBeingFollowed, String tags) {
        String _userToFollow = userBeingFollowed;
        _userToFollow = XString.stripIfStartsWith(_userToFollow, "@");
        // duplicate variable because of lambdas below
        String userToFollow = _userToFollow;
        if (userToFollow.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
            return "You can't be friends with the admin.";
        }
        // If we don't know the account id of the person doing the follow, then look it up.
        if (accntIdDoingFollow == null) {
            SubNode followerAcctNode = arun.run(s -> read.getAccountByUserName(s, userDoingFollow, false));
            if (followerAcctNode == null) {
                throw new RuntimeException("Unable to find user: " + userDoingFollow);
            }
            accntIdDoingFollow = followerAcctNode.getId();
        }
        addFriendInternal(ThreadLocals.getMongoSession(), userDoingFollow, accntIdDoingFollow, userToFollow, tags);
        return "Added Friend: " + userToFollow;
    }

    /* The code pattern here is very similar to 'blockUser' */
    private void addFriendInternal(MongoSession ms, String userDoingFollow, ObjectId accntIdDoingFollow,
            String userToFollow, String tags) {
        SubNode followerFriendList =
                read.getUserNodeByType(ms, userDoingFollow, null, null, NodeType.FRIEND_LIST.s(), null, true);
        if (followerFriendList == null) {
            log.debug("Can't access Friend list for: " + userDoingFollow);
            return;
        }
        /*
         * lookup to see if this followerFriendList node already has userToFollow already under it.
         */
        SubNode friendNode = read.findFriendNode(ms, accntIdDoingFollow, null, userToFollow);
        // if we have this node but in some obsolete path delete it. Might be the path of BLOCKED_USERS
        if (friendNode != null && !mongoUtil.isChildOf(followerFriendList, friendNode)) {
            delete.delete(ms, friendNode);
            friendNode = null;
        }
        // if friendNode is non-null here it means we were already following the user.
        if (friendNode != null)
            return;
        if (userToFollow.contains("@")) {
            apub.loadForeignUser(userDoingFollow, userToFollow, false);
        }
        // the passed in 'ms' may or may not be admin session, but we always DO need this with admin, so we
        // must use arun.
        SubNode userNode = arun.run(s -> read.getAccountByUserName(s, userToFollow, false));
        if (userNode == null)
            return;

        // follower bot never blocks people, so we can avoid calling that if follower bot.
        if (!userDoingFollow.equals(PrincipalName.FOLLOW_BOT.s())) {
            // We can't have both a FRIEND and a BLOCK so remove the friend. There's also a unique constraint on
            // the DB enforcing this.
            deleteFriend(ms, userNode.getIdStr(), NodeType.BLOCKED_USERS.s());
        }
        log.trace("Creating friendNode for " + userToFollow);
        friendNode = createFriendNode(ms, followerFriendList, userToFollow, tags);
        if (friendNode != null) {
            friendNode.set(NodeProp.USER_NODE_ID, userNode.getIdStr());
            // updates AND sends the friend request out to the foreign server.
            updateSavedFriendNode(userDoingFollow, friendNode);
        }
    }

    public FriendInfo buildPersonInfoFromFriendNode(MongoSession ms, SubNode friendNode) {
        String userName = friendNode.getStr(NodeProp.USER);
        FriendInfo fi = null;
        if (userName != null) {
            fi = new FriendInfo();
            fi.setFriendNodeId(friendNode.getIdStr());
            fi.setUserName(userName);
            fi.setTags(friendNode.getTags());
            fi.setForeignAvatarUrl(friendNode.getStr(NodeProp.USER_ICON_URL));
            String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
            SubNode friendAccountNode = read.getNode(ms, userNodeId, false, null);
            if (friendAccountNode != null) {
                fi.setDisplayName(user.getFriendlyNameFromNode(friendAccountNode));

                // if a local user use BIN property on node (account node BIN property is the Avatar)
                if (userName.indexOf("@") == -1) {
                    Attachment att = friendAccountNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
                    if (att != null) {
                        fi.setAvatarVer(att.getBin());
                    }
                } else { // Otherwise the avatar will be specified as a remote user's Icon.
                    // set avatar here only if we didn't set it above already
                    if (fi.getForeignAvatarUrl() == null) {
                        fi.setForeignAvatarUrl(friendAccountNode.getStr(NodeProp.USER_ICON_URL));
                    }
                }
            } else {
                return null;
            }
            fi.setUserNodeId(userNodeId);
        }
        return fi;
    }

    /*
     * Adds all the users in 'req.userName' (as a newline elimited list) as new friends of the current
     * user
     */
    public AddFriendResponse addFriend(MongoSession ms, AddFriendRequest req) {
        AddFriendResponse res = new AddFriendResponse();
        String userDoingAction = ThreadLocals.getSC().getUserName();
        final List<String> users = XString.tokenize(req.getUserName().trim(), "\n", true);

        users.forEach(u -> {
            Val<String> userVal = new Val<>();
            Val<String> tagsVal = new Val<>();

            user.parseImportUser(u, userVal, tagsVal);
            String tags = tagsVal.getVal() != null ? tagsVal.getVal() : req.getTags();
            addFriend(ms, userDoingAction, null, userVal.getVal(), tags);
        });
        return res;
    }
}
