package quanta.service;

import java.util.Date;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.config.NodePath;
import quanta.config.ServiceBase;
import quanta.config.SessionContext;
import quanta.model.NodeInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.mongo.model.SubNode;
import quanta.rest.request.CheckMessagesRequest;
import quanta.rest.request.NodeFeedRequest;
import quanta.rest.response.CheckMessagesResponse;
import quanta.rest.response.NodeFeedResponse;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.XString;

@Component
public class UserFeedService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(UserFeedService.class);
    private static final int MAX_FEED_ITEMS = 25;

    // DO NOT DELETE (part of example to keep below)
    // private static List<String> excludeTypes = Arrays.asList( //
    // NodeType.FRIEND.s(), //
    // NodeType.POSTS.s());
    public CheckMessagesResponse cm_checkMessages(CheckMessagesRequest req) {
        SessionContext sc = TL.getSC();
        CheckMessagesResponse res = new CheckMessagesResponse();
        if (sc.isAnon())
            return res;
        String pathToSearch = NodePath.USERS_PATH;
        Query q = new Query();
        Criteria crit = svc_mongoUtil.subGraphCriteria(pathToSearch); //
        /*
         * limit to just markdown types and comments, because we need to avoid everything else since we are
         * searching from the root of all user accounts.
         */
        crit = crit.and(SubNode.TYPE).in(NodeType.NONE.s(), NodeType.COMMENT.s());
        // DO NOT DELETE (keep as example)
        // This pattern is what is required when you have multiple conditions added to a single field.
        // .andOperator(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()), //
        // Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s()));
        SubNode searchRoot = svc_mongoRead.getNode(sc.getUserNodeId());
        if (searchRoot == null) {
            return res;
        }
        Long lastActiveLong = searchRoot.getInt(NodeProp.LAST_ACTIVE_TIME);
        if (lastActiveLong == 0) {
            return res;
        }
        // new nodes since last active time
        crit = crit.and(SubNode.MODIFY_TIME).gt(new Date(lastActiveLong));
        String myId = searchRoot.getOwner().toHexString();
        crit = crit.and(SubNode.AC + "." + myId).ne(null);
        crit = svc_auth.addReadSecurity(crit);
        q.addCriteria(crit);
        long count = svc_ops.count(q);
        res.setNumNew((int) count);
        return res;
    }

    /*
     * Generated content of the "Feed" for a user.
     *
     * Note: When 'req.toUser' is set we query actually for the bidiretional conversatio of us to that
     * person or that person to us queried in a single list.
     */
    public NodeFeedResponse cm_generateFeed(NodeFeedRequest req) {
        /*
         * if bidirectional means query for the conversation between me and the other person (both senders),
         * and we do that always for now when toUser is present.
         */
        boolean bidirectional = StringUtils.isNotEmpty(req.getToUser());
        SessionContext sc = TL.getSC();
        sc.setViewingFeed(true);

        NodeFeedResponse res = new NodeFeedResponse();
        List<Criteria> ands = new LinkedList<>();

        int counter = 0;
        List<Criteria> orCriteria = new LinkedList<>();
        // 2: should the 'friends' and 'public' options be mutually exclusive?? If someone's looking for
        // all public nodes why "OR" into that any friends?
        if (req.getToPublic()) {
            orCriteria.add(Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null));
        }

        SubNode myAcntNode = null;

        // includes shares TO me (but not in the context of a 'bidirectional' query)
        if (req.getToMe()) {
            myAcntNode = svc_mongoRead.getNode(sc.getUserNodeId());
            if (myAcntNode != null) {
                orCriteria.add(Criteria.where(SubNode.AC + "." + myAcntNode.getOwner().toHexString()).ne(null));
                SubNode _myAcntNode = myAcntNode;
                long lastActiveTime = sc.getLastActiveTime();
                // do this work in async thread to make this query more performant
                svc_async.run(() -> {
                    /*
                     * setting last active time to this current time, will stop the GUI from showing the user an
                     * indication that they have new messages, because we know they're querying messages NOW, so this is
                     * a way to reset
                     */
                    _myAcntNode.set(NodeProp.LAST_ACTIVE_TIME, lastActiveTime);
                    svc_mongoUpdate.save(_myAcntNode);
                });
            }
        }
        List<NodeInfo> searchResults = new LinkedList<>();
        res.setSearchResults(searchResults);

        Query q = new Query();
        // initialize criteria using the Path to select the correct sub-graph of the tree
        Criteria crit = svc_mongoUtil.subGraphCriteria(NodePath.USERS_PATH); //
        // DO NOT DELETE (keep as an example of how to do this)
        // if (no(req.getNodeId() )) {
        // criteria = criteria.and(SubNode.FIELD_TYPE).nin(excludeTypes);
        // }
        // limit to just markdown types (no type), and comments
        // IMPORTANT: see long comment above where we have similar type filtering.
        ands.add(Criteria.where(SubNode.TYPE).in(NodeType.NONE.s(), NodeType.COMMENT.s()));

        // DO NOT DELETE.
        // This code itself is completely obsolete, but it is an example of how to do an OR query.
        // List<Criteria> orCrit = new LinkedList<>();
        // // This detects 'local nodes' (nodes from local users, by them NOT having an OBJECT_ID)
        // orCrit.add(new Criteria(SubNode.PROPS + "." + NodeProp.OBJECT_ID).is(null));
        // // this regex simly is "Starts with a period"
        // orCrit.add(new Criteria(SubNode.PROPS + "." + NodeProp.OBJECT_ID).not().regex("^\\."));
        // ands.add(new Criteria().orOperator(orCrit));

        // Don't show UNPUBLISHED nodes. The whole point of having the UNPUBLISHED feature for nodes is so
        // we can do this criteria right here and not show those in feeds.
        ands.add(new Criteria(SubNode.PROPS + "." + NodeProp.UNPUBLISHED).is(null));
        // Save the 'string' representations for blocked user ids for use below, to mask out places where
        // users may be following a user that will effectively be blocked
        HashSet<String> blockedIdStrings = new HashSet<>();
        HashSet<ObjectId> blockedUserIds = new HashSet<>();

        /*
         * We block the "remote users" and "local users" by blocking any admin owned nodes, but we also just
         * want to in general for other reasons block any admin-owned nodes from showing up in feeds. Feeds
         * are always only about user content.
         */
        blockedUserIds.add(svc_auth.getAdminSC().getUserNodeObjId());

        if (!bidirectional) {
            // this logic makes it so that any feeds using 'public' checkbox will have the admin-blocked users
            // removed from it.
            // Add ADMIN BLOCKS
            if (req.getToPublic() && req.isApplyAdminBlocks()) {
                getBlockedUserIds(blockedUserIds, PrincipalName.ADMIN.s());
            }
            // Add criteria for blocking users using the 'not in' list (nin)
            // Add THIS USER BLOCKS
            getBlockedUserIds(blockedUserIds, null);
            if (blockedUserIds.size() > 0) {
                ands.add(Criteria.where(SubNode.OWNER).nin(blockedUserIds));
            }
            for (ObjectId blockedId : blockedUserIds) {
                blockedIdStrings.add(blockedId.toHexString());
            }
        }
        /*
         * for bidirectional we do an OR of "us to them" and "them to us" kind of sharing to the other user,
         * to result in what will end up being all conversations between us and the other person mixed into
         * a single rev-chron.
         */
        else {
            SubNode toUserNode = svc_user.getAccountByUserNameAP(req.getToUser());
            if (myAcntNode == null) {
                myAcntNode = svc_mongoRead.getNode(sc.getUserNodeId());
            }
            if (myAcntNode != null) {
                // sharing from us to the other user.where node is owned by us and the node has any sharing on it.
                orCriteria.add(Criteria.where(SubNode.OWNER).is(myAcntNode.getOwner())
                        .and(SubNode.AC + "." + toUserNode.getId().toHexString()).ne(null));
                // sharing from the other user to us. where node is owned by us. and the node has any sharing on it.
                if (bidirectional) {
                    orCriteria.add(Criteria.where(SubNode.OWNER).is(toUserNode.getOwner())
                            .and(SubNode.AC + "." + myAcntNode.getId().toHexString()).ne(null));
                }
            }
        }

        if (req.getFromMe()) {
            if (myAcntNode == null) {
                myAcntNode = svc_mongoRead.getNode(sc.getUserNodeId());
            }
            if (myAcntNode != null) {
                // where node is owned by us. and the node has any sharing on it.
                orCriteria.add(Criteria.where(SubNode.OWNER).is(myAcntNode.getOwner()).and(SubNode.AC).ne(null));
            }
        }

        if (req.getFromFriends()) {
            List<ObjectId> friendIds = new LinkedList<>();
            boolean friendsProcessed = false;
            if (req.getLoadFriendsTags() || TL.getSC().isFriendsTagsDirty()) {
                // if we're going to be scanning ALL friends then the block below that would scan for friends
                // can be bypassed, because we will have already loaded friendIds
                friendsProcessed = true;
                TL.getSC().setFriendsTagsDirty(false);
                HashSet<String> friendsHashTagsSet = new HashSet<>();
                List<SubNode> allFriendNodes =
                        svc_user.getSpecialNodesList(null, NodeType.FRIEND_LIST.s(), null, true, null);

                if (allFriendNodes == null || allFriendNodes.size() == 0) {
                    res.setMessage("You haven't added any Friends yet.");
                    return res;
                }

                if (allFriendNodes != null) {
                    for (SubNode friendNode : allFriendNodes) {
                        List<String> hashTags = XString.tokenize(friendNode.getTags(), " ,", false);
                        if (hashTags != null) {
                            for (String hashTag : hashTags) {
                                // ignore anything that happens not to be a tag
                                if (hashTag.startsWith("#")) {
                                    friendsHashTagsSet.add(hashTag);
                                }
                            }
                        }
                        // since we're processing ALL friends we can go ahead and update friendIds here
                        // but also only do that if we're not filtering for tags, or the filter is a match
                        if (StringUtils.isEmpty(req.getFriendsTagSearch()) || //
                                (StringUtils.isNotEmpty(friendNode.getTags())
                                        && friendNode.getTags().contains(req.getFriendsTagSearch()))) {
                            String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
                            // if we have a userNodeId and they aren't in the blocked list.
                            if (userNodeId != null && !blockedIdStrings.contains(userNodeId)) {
                                friendIds.add(new ObjectId(userNodeId));
                            }
                        }
                    }
                    // returning an empty list when there are no tags is a meaningful result and will trigger
                    // the client to update that there are no hashtags
                    res.setFriendHashTags(new LinkedList<String>(friendsHashTagsSet));
                }
            }

            // if we already processed friends above, then we know we don't need to do it here. It's done.
            if (!friendsProcessed) {
                Criteria tagCriteria = null;
                if (!StringUtils.isEmpty(req.getFriendsTagSearch())) {
                    tagCriteria = Criteria.where(SubNode.TAGS).regex(req.getFriendsTagSearch());
                }
                List<SubNode> friendNodes =
                        svc_user.getSpecialNodesList(null, NodeType.FRIEND_LIST.s(), null, true, tagCriteria);
                if (friendNodes == null || friendNodes.size() == 0) {
                    res.setMessage("You haven't added any Friends yet.");
                    return res;
                }
                if (friendNodes != null) {
                    for (SubNode friendNode : friendNodes) {
                        // the USER_NODE_ID property on friends nodes contains the actual account ID of this friend.
                        String userNodeId = friendNode.getStr(NodeProp.USER_NODE_ID);
                        // if we have a userNodeId and they aren't in the blocked list.
                        if (userNodeId != null && !blockedIdStrings.contains(userNodeId)) {
                            friendIds.add(new ObjectId(userNodeId));
                        }
                    }
                }
            }
            if (friendIds.size() > 0) {
                orCriteria.add(Criteria.where(SubNode.OWNER).in(friendIds));
            }
        }
        if (orCriteria.size() > 0) {
            ands.add(new Criteria().orOperator(orCriteria));
        }

        TextCriteria textCriteria = null;
        // Add 'Blocked Words' criteria only if we're not doing a "From Me" or "From Friends" kind of feed.
        if (!req.getFromMe() && !req.getFromFriends() && TL.getSC().getUserNodeId() != null) {
            // Filter USER_BLOCK_WORDS if user has defined any
            SubNode userNode = svc_ops.findById(new ObjectId(TL.getSC().getUserNodeId()));
            if (userNode != null) {
                String blockedWords = userNode.getStr(NodeProp.USER_BLOCK_WORDS);
                if (StringUtils.isNotEmpty(blockedWords)) {
                    StringTokenizer t = new StringTokenizer(blockedWords, " \n\r\t,", false);
                    StringBuilder regex = new StringBuilder();
                    while (t.hasMoreTokens()) {
                        if (regex.length() > 0) {
                            regex.append("|");
                        }
                        regex.append(t.nextToken());
                    }
                    ands.add(Criteria.where(SubNode.CONTENT).not().regex(regex.toString(), "i"));
                }
            }
        }

        if (!StringUtils.isEmpty(req.getSearchText())) {
            if (textCriteria == null) {
                textCriteria = TextCriteria.forDefaultLanguage();
            }
            textCriteria.matching(req.getSearchText());
        }

        if (textCriteria != null) {
            textCriteria.caseSensitive(false);
            q.addCriteria(textCriteria);
        }

        crit = svc_auth.addReadSecurity(crit, ands);
        q.addCriteria(crit);
        q.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));

        // we get up to 2x the max item so that if large numbers of them are being filtered,
        // we can still return a page of results hopefully
        q.limit(MAX_FEED_ITEMS * 2);
        if (req.getPage() > 0) {
            q.skip(MAX_FEED_ITEMS * req.getPage());
        }

        Iterable<SubNode> iter = svc_ops.find(q);
        int skipped = 0;

        for (SubNode node : iter) {
            try {
                NodeInfo info =
                        svc_convert.toNodeInfo(false, sc, node, false, counter + 1, false, false, false, true, null);
                if (info != null) {
                    searchResults.add(info);
                    if (searchResults.size() >= MAX_FEED_ITEMS) {
                        break;
                    }
                }
            } catch (Exception e) {
                ExUtil.error(log, "convertToNodeInfo", e);
            }
        }
        if (searchResults.size() < MAX_FEED_ITEMS - skipped) {
            res.setEndReached(true);
        }
        return res;
    }

    public LinkedList<String> getFriendsHashTags() {
        HashSet<String> friendsHashTagsSet = new HashSet<>();
        List<SubNode> allFriendNodes = svc_user.getSpecialNodesList(null, NodeType.FRIEND_LIST.s(), null, true, null);
        if (allFriendNodes != null) {
            for (SubNode friendNode : allFriendNodes) {
                List<String> hashTags = XString.tokenize(friendNode.getTags(), " ,", false);
                if (hashTags != null) {
                    for (String hashTag : hashTags) {
                        // ignore anything that happens not to be a tag
                        if (hashTag.startsWith("#")) {
                            friendsHashTagsSet.add(hashTag);
                        }
                    }
                }
            }
            return new LinkedList<String>(friendsHashTagsSet);
        }
        return null;
    }

    /*
     * Blocked from the perspective of 'userName', and a null userName here indicates, current session
     * user.
     */
    public void getBlockedUserIds(HashSet<ObjectId> set, String userName) {
        svc_arun.run(() -> {
            List<SubNode> nodeList =
                    svc_user.getSpecialNodesList(null, NodeType.BLOCKED_USERS.s(), userName, false, null);
            if (nodeList == null)
                return null;

            for (SubNode node : nodeList) {
                String userNodeId = node.getStr(NodeProp.USER_NODE_ID);
                if (userNodeId != null) {
                    set.add(new ObjectId(userNodeId));
                }
            }
            return null;
        });
    }
}
