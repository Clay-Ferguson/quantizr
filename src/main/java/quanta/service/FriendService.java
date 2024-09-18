package quanta.service;

import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeInfo;
import quanta.model.PropertyInfo;
import quanta.model.client.Attachment;
import quanta.model.client.Constant;
import quanta.model.client.ConstantInt;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.MongoTranMgr;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.CreateNodeLocation;
import quanta.mongo.model.SubNode;
import quanta.rest.request.AddFriendRequest;
import quanta.rest.request.GetFollowersRequest;
import quanta.rest.request.GetFollowingRequest;
import quanta.rest.request.UpdateFriendNodeRequest;
import quanta.rest.response.AddFriendResponse;
import quanta.rest.response.DeleteFriendResponse;
import quanta.rest.response.FriendInfo;
import quanta.rest.response.GetFollowersResponse;
import quanta.rest.response.GetFollowingResponse;
import quanta.rest.response.GetThreadViewResponse;
import quanta.rest.response.UpdateFriendNodeResponse;
import quanta.util.Convert;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.Val;

@Component
public class FriendService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(FriendService.class);

    public SubNode createFriendNode(SubNode parentFriendsList, String userToFollow, String tags) {
        // get userNode of user to follow
        AccountNode userNode = svc_user.getAccountByUserNameAP(userToFollow);
        if (userNode != null) {
            List<PropertyInfo> properties = new LinkedList<>();
            properties.add(new PropertyInfo(NodeProp.USER.s(), userToFollow));
            properties.add(new PropertyInfo(NodeProp.USER_NODE_ID.s(), userNode.getIdStr()));

            SubNode friendNode = svc_mongoCreate.createNode(parentFriendsList, null, NodeType.FRIEND.s(), null, 0L,
                    CreateNodeLocation.LAST, properties, parentFriendsList.getOwner(), true, true, null);
            friendNode.set(NodeProp.TYPE_LOCK, Boolean.valueOf(true));

            if (tags != null) {
                friendNode.setTags(tags);
            }

            svc_mongoUpdate.save(friendNode);
            return friendNode;
        } else {
            throw new RuntimeEx("User not found: " + userToFollow);
        }
    }

    public UpdateFriendNodeResponse cm_updateFriendNode(UpdateFriendNodeRequest req) {
        UpdateFriendNodeResponse res = new UpdateFriendNodeResponse();
        SubNode node = svc_mongoRead.getNode(req.getNodeId());
        svc_auth.ownerAuth(node);
        if (!NodeType.FRIEND.s().equals(node.getType())) {
            throw new RuntimeEx("Not a Friend node.");
        }
        node.setTags(req.getTags());
        return res;
    }

    public void updateSavedFriendNode(String userDoingAction, SubNode node) {
        String userNodeId = node.getStr(NodeProp.USER_NODE_ID);
        String friendUserName = node.getStr(NodeProp.USER);
        if (friendUserName != null) {
            // when user first adds, this friendNode won't have the userNodeId yet, so add if not yet existing
            if (userNodeId == null) {
                Val<AccountNode> userNode = new Val<>();

                userNode.setVal(svc_user.getAccountByUserNameAP(friendUserName));

                if (userNode.getVal() != null) {
                    userNodeId = userNode.getVal().getIdStr();
                    node.set(NodeProp.USER_NODE_ID, userNodeId);
                }
            }
        }
    }

    public DeleteFriendResponse deleteFriend(String delUserNodeId, String parentType) {
        MongoTranMgr.ensureTran();
        DeleteFriendResponse res = new DeleteFriendResponse();
        Criteria crit = Criteria.where(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(delUserNodeId); //
        List<SubNode> friendNodes = svc_user.getSpecialNodesList(null, parentType, null, false, crit);
        if (friendNodes != null) {
            // we run a for loop but there will only be only up to one friend node in this result set.
            for (SubNode friendNode : friendNodes) {
                // we delete with updateHasChildren=false, because it's more efficient
                svc_mongoDelete.delete(friendNode, false);
            }
        }
        return res;
    }

    /*
     * Adds 'req.userName' as a friend by creating a FRIEND node under the current user's FRIENDS_LIST
     * if the user wasn't already a friend
     */
    public String addFriend(String userDoingFollow, ObjectId accntIdDoingFollow, String userBeingFollowed,
            String tags) {
        String _userToFollow = userBeingFollowed;
        _userToFollow = XString.stripIfStartsWith(_userToFollow, "@");
        // duplicate variable because of lambdas below
        String userToFollow = _userToFollow;
        if (userToFollow.equalsIgnoreCase(PrincipalName.ADMIN.s())) {
            return "You can't be friends with the admin.";
        }
        // If we don't know the account id of the person doing the follow, then look it up.
        if (accntIdDoingFollow == null) {
            AccountNode followerAcctNode = svc_arun.run(() -> svc_user.getAccountByUserNameAP(userDoingFollow));
            if (followerAcctNode == null) {
                throw new RuntimeEx("Unable to find user: " + userDoingFollow);
            }
            accntIdDoingFollow = followerAcctNode.getId();
        }
        addFriendInternal(userDoingFollow, accntIdDoingFollow, userToFollow, tags);
        return "Added Friend: " + userToFollow;
    }

    /* The code pattern here is very similar to 'blockUser' */
    private void addFriendInternal(String userDoingFollow, ObjectId accntIdDoingFollow, String userToFollow,
            String tags) {
        SubNode followerFriendList = svc_mongoRead.getUserNodeByType(userDoingFollow, null, "### Friends",
                NodeType.FRIEND_LIST.s(), null, true);
        if (followerFriendList == null) {
            log.debug("Can't access Friend list for: " + userDoingFollow);
            return;
        }
        // lookup to see if this followerFriendList node already has userToFollow already under it.
        SubNode friendNode = findFriendNode(accntIdDoingFollow, null, userToFollow);
        // if we have this node but in some obsolete path delete it. Might be the path of BLOCKED_USERS
        if (friendNode != null && !svc_mongoUtil.isChildOf(followerFriendList, friendNode)) {
            svc_mongoDelete.delete(friendNode);
            friendNode = null;
        }
        // if friendNode is non-null here it means we were already following the user.
        if (friendNode != null)
            return;

        // the passed in 'ms' may or may not be admin session, but we always DO need this with admin, so we
        // must use arun.
        AccountNode userNode = svc_arun.run(() -> svc_user.getAccountByUserNameAP(userToFollow));
        if (userNode == null)
            return;

        // We can't have both a FRIEND and a BLOCK so remove the friend. There's also a unique constraint on
        // the DB enforcing this.
        svc_mongoTrans.cm_deleteFriend(userNode.getIdStr(), NodeType.BLOCKED_USERS.s());

        log.trace("Creating friendNode for " + userToFollow);
        friendNode = createFriendNode(followerFriendList, userToFollow, tags);
        if (friendNode != null) {
            friendNode.set(NodeProp.USER_NODE_ID, userNode.getIdStr());
            // updates AND sends the friend request out to the foreign server.
            updateSavedFriendNode(userDoingFollow, friendNode);
        }
    }

    public FriendInfo buildPersonInfoFromFriendNode(SubNode friendNode) {
        String userName = friendNode.getStr(NodeProp.USER);
        FriendInfo fi = null;
        if (userName != null) {
            fi = new FriendInfo();
            fi.setFriendNodeId(friendNode.getIdStr());
            fi.setUserName(userName);
            fi.setTags(friendNode.getTags());
            String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
            AccountNode friendAccountNode = svc_user.getAccountNodeAP(userNodeId);
            if (friendAccountNode != null) {
                fi.setDisplayName(svc_user.getFriendlyNameFromNode(friendAccountNode));
                Attachment att = friendAccountNode.getAttachment(Constant.ATTACHMENT_PRIMARY.s(), false, false);
                if (att != null) {
                    fi.setAvatarVer(att.getBin());
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
    public AddFriendResponse addFriend(AddFriendRequest req) {
        MongoTranMgr.ensureTran();
        AddFriendResponse res = new AddFriendResponse();
        String userDoingAction = TL.getSC().getUserName();
        final List<String> users = XString.tokenize(req.getUserName().trim(), "\n", true);

        users.forEach(u -> {
            Val<String> userVal = new Val<>();
            Val<String> tagsVal = new Val<>();

            svc_user.parseImportUser(u, userVal, tagsVal);
            String tags = tagsVal.getVal() != null ? tagsVal.getVal() : req.getTags();
            addFriend(userDoingAction, null, userVal.getVal(), tags);
        });
        return res;
    }

    private static final int MAX_THREAD_NODES = 200;

    public GetThreadViewResponse cm_getNodeReplies(String nodeId) {
        GetThreadViewResponse res = new GetThreadViewResponse();
        LinkedList<NodeInfo> nodes = new LinkedList<>();
        // get node that's going to have it's ancestors gathered
        SubNode node = svc_mongoRead.getNode(nodeId);
        if (node == null)
            return res;
        NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, Convert.LOGICAL_ORDINAL_IGNORE, false,
                false, false, true, null);
        nodes.add(info);
        if (nodes.size() > 1) {
            res.setNodes(nodes);
        }
        return res;
    }

    /*
     * Gets the "[Conversation] Thread" for 'nodeId' which is kind of the equivalent of the walk up
     * towards the root of the tree.
     */
    public GetThreadViewResponse cm_getNodeThreadView(String nodeId, boolean loadOthers) {
        boolean debug = false;
        GetThreadViewResponse res = new GetThreadViewResponse();
        LinkedList<NodeInfo> nodes = new LinkedList<>();
        if (debug) {
            log.debug("getNodeThreadView() " + nodeId);
        }
        // get node that's going to have it's ancestors gathered
        SubNode node = svc_mongoRead.getNode(nodeId);
        boolean topReached = false;
        ObjectId lastNodeId = null;
        boolean isAiConversation = false;
        int consecutiveNonAnswers = 0;

        // iterate up the parent hierarchy until we reach the top or until we've gathered enough nodes
        while (node != null && (nodes.size() < MAX_THREAD_NODES)) {
            try {
                NodeInfo info = null;
                boolean isAiResponse = NodeType.fromType(node.getType()) == NodeType.AI_ANSWER;

                // if we're going up an AI conversation thread, detect two back to back non-answer types and that
                // indicates we need to stop, becasue we're at the beginning of the conversation.
                if (isAiConversation) {
                    if (isAiResponse) {
                        consecutiveNonAnswers = 0;
                    } else {
                        consecutiveNonAnswers++;
                    }
                    if (consecutiveNonAnswers > 1) {
                        topReached = true;
                        break;
                    }
                } else {
                    // detect if this is an AI conversation (only once, and only if it's not already set to true)
                    if (isAiResponse) {
                        isAiConversation = true;
                    }
                }

                // note topNode doesn't necessarily mean we're done iterating because it's 'inReplyTo' still may
                // point to further places 'logically above' (in this conversation thread)
                boolean topNode = node.isType(NodeType.POSTS) || node.isType(NodeType.ACCOUNT);
                if (!topNode) {
                    info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, Convert.LOGICAL_ORDINAL_IGNORE, false,
                            false, false, true, null);
                    // we only collect children at this level if it's not an account top level post
                    if (loadOthers) {
                        Iterable<SubNode> iter = svc_mongoRead.getChildren(node,
                                Sort.by(Sort.Direction.DESC, SubNode.CREATE_TIME), 20, 0);
                        HashSet<String> childIds = new HashSet<>();
                        List<NodeInfo> children = new LinkedList<>();
                        for (SubNode child : iter) {
                            if (!child.getId().equals(lastNodeId)) {
                                childIds.add(child.getIdStr());
                                children.add(svc_convert.toNodeInfo(false, TL.getSC(), child, false,
                                        Convert.LOGICAL_ORDINAL_IGNORE, false, false, false, true, null));
                            }
                        }

                        if (children.size() > 0) {
                            info.setChildren(children);
                        }
                    }
                }
                if (info != null) {
                    nodes.addFirst(info);
                    lastNodeId = node.getId();
                }
                // if topNode, set parent to null, to trigger the only path up to have to
                // go thru an inReplyTo, rather than be based on tree structure.
                // SubNode parent = topNode ? null : read.getParent(ms, node);
                SubNode parent = null;
                if (topNode) {
                    // leave parent == null;
                } else {
                    parent = svc_mongoRead.getParent(node);
                }
                node = parent;
                if (node == null) {
                    topReached = true;
                }
            } catch (Exception e) {
                node = null;
                topReached = true;
            }
        }
        if (node == null) {
            topReached = true;
        }
        res.setTopReached(topReached);
        res.setNodes(nodes);
        if (nodes.size() > 1) {
            // sort all children also
            for (NodeInfo n : nodes) {
                if (n.getChildren() != null) {
                    n.getChildren().sort((n1, n2) -> (int) n1.getLastModified().compareTo(n2.getLastModified()));
                }
            }
        }
        if (debug) {
            log.debug("getNodeThreadView() RESP: " + XString.prettyPrint(res));
        }
        return res;
    }

    public Long getFollowersCount(String userMakingRequest, String userName) {
        return (Long) svc_arun.run(() -> {
            Long count = countFollowersOfUser(userMakingRequest, null, userName);
            return count;
        });
    }

    public GetFollowersResponse cm_getFollowers(GetFollowersRequest req) {
        GetFollowersResponse res = new GetFollowersResponse();
        return svc_arun.run(() -> {
            Query q = getPeopleByUserName_query(null, req.getTargetUserName());
            if (q == null)
                return null;
            q.limit(ConstantInt.ROWS_PER_PAGE.val());
            q.skip(ConstantInt.ROWS_PER_PAGE.val() * req.getPage());
            Iterable<SubNode> iterable = svc_ops.find(q);
            List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
            int counter = 0;

            for (SubNode node : iterable) {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, true,
                        false, null);
                if (info != null) {
                    searchResults.add(info);
                }
            }
            res.setSearchResults(searchResults);
            return res;
        });
    }

    public long countFollowersOfUser(String userMakingRequest, AccountNode userNode, String userName) {
        return countFollowersOfLocalUser(userNode, userName);
    }

    public long countFollowersOfLocalUser(AccountNode userNode, String userName) {
        Query q = getPeopleByUserName_query(userNode, userName);
        if (q == null)
            return 0L;
        return svc_ops.count(q);
    }

    /* caller can pass userName only or else pass userNode if it's already available */
    public Query getPeopleByUserName_query(AccountNode userNode, String userName) {
        Query q = new Query();
        if (userNode == null) {
            userNode = svc_user.getAccountByUserNameAP(userName);
            if (userNode == null) {
                return null;
            }
        }
        Criteria crit =
                svc_mongoUtil.subGraphCriteria(NodePath.USERS_PATH).and(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s())
                        .is(userNode.getIdStr()).and(SubNode.TYPE).is(NodeType.FRIEND.s());
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return q;
    }

    public Long getFollowingCount(String userDoingAction, String userName) {
        return (Long) svc_arun.run(() -> {
            Long count = countFollowingOfUser(userDoingAction, userName);
            return count;
        });
    }

    /*
     * This function is similar to getPeople, but since getPeople is for a picker dialog we can consider
     * it to be the odd man out which will eventually need to support paging (currently doesn't) and go
     * ahead and duplicate that functionality here in a way analogous to getFollowers
     */
    public GetFollowingResponse cm_getFollowing(GetFollowingRequest req) {
        GetFollowingResponse res = new GetFollowingResponse();
        return svc_arun.run(() -> {
            Query q = findFollowingOfUser_query(req.getTargetUserName());
            if (q == null)
                return null;
            q.limit(ConstantInt.ROWS_PER_PAGE.val());
            q.skip(ConstantInt.ROWS_PER_PAGE.val() * req.getPage());
            Iterable<SubNode> iterable = svc_ops.find(q);
            List<NodeInfo> searchResults = new LinkedList<>();
            int counter = 0;

            for (SubNode node : iterable) {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                        false, null);
                if (info != null) {
                    searchResults.add(info);
                }
            }
            res.setSearchResults(searchResults);
            return res;
        });
    }

    // Returns FRIEND nodes for every user 'userName' is following
    public Iterable<SubNode> findFollowingOfUser(String userName) {
        Query q = findFollowingOfUser_query(userName);
        if (q == null)
            return null;
        return svc_ops.find(q);
    }

    public long countFollowingOfUser(String userDoingAction, String userName) {
        return countFollowingOfLocalUser(userName);
    }

    public long countFollowingOfLocalUser(String userName) {
        Query q = findFollowingOfUser_query(userName);
        if (q == null)
            return 0;
        return svc_ops.count(q);
    }

    private Query findFollowingOfUser_query(String userName) {
        Query q = new Query();
        // get friends list node
        SubNode friendsListNode = svc_user.getFriendsList(userName, false);
        if (friendsListNode == null)
            return null;
        // query all the direct children under the friendsListNode, that are FRIEND type although they
        // should all be FRIEND types.
        Criteria crit =
                svc_mongoUtil.childrenCriteria(friendsListNode.getPath()).and(SubNode.TYPE).is(NodeType.FRIEND.s());

        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        return q;
    }

    /*
     * userNode and userName correspond to the FRIEND node and not the person who OWNS the friend node.
     * The person whose friend we're trying to look up is 'ownerId' so they will be the OWNER of the
     * FriendNode.
     *
     * Note: Blocked users are also stored as a "FriendNode", but under the "blocked list"
     */
    public SubNode findFriendNode(ObjectId ownerId, AccountNode userNode, String userName) {
        if (userNode == null) {
            userNode = svc_user.getAccountByUserNameAP(userName);
            if (userNode == null) {
                return null;
            }
        }
        // Otherwise for ordinary users root is based off their username
        Query q = new Query();
        Criteria crit = Criteria.where(SubNode.OWNER).is(ownerId).and(SubNode.TYPE).is(NodeType.FRIEND.s())
                .and(SubNode.PROPS + "." + NodeProp.USER_NODE_ID.s()).is(userNode.getIdStr());
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        SubNode ret = svc_ops.findOne(q);
        return ret;
    }
}
