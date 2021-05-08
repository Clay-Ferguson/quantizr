package org.subnode.actpub;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdminEx;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.DateUtil;
import org.subnode.util.ValContainer;
import org.subnode.util.XString;

@Component
public class ActPubOutbox {
    private static final Logger log = LoggerFactory.getLogger(ActPubOutbox.class);

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
    private MongoAuth auth;

    @Autowired
	@Qualifier("threadPoolTaskExecutor")
	private Executor executor;

    /**
     * Caller can pass in userNode if it's already available, but if not just pass null and the
     * apUserName will be used to look up the userNode.
     */
    public void refreshOutboxFromForeignServer(MongoSession session, Object actor, SubNode userNode, String apUserName) {

        if (userNode == null) {
            userNode = read.getUserNodeByUserName(session, apUserName);
        }

        SubNode outboxNode = read.getUserNodeByType(session, apUserName, userNode, "### Posts", NodeType.ACT_PUB_POSTS.s(), 
        Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()));
        if (outboxNode == null) {
            log.debug("no outbox for user: " + apUserName);
            return;
        }

        /*
         * Query all existing known outbox items we have already saved for this foreign user
         */
        Iterable<SubNode> outboxItems = read.getSubGraph(session, outboxNode, null, 0);

        String outboxUrl = AP.str(actor, "outbox");
        Object outbox = getOutbox(outboxUrl);
        if (outbox == null) {
            log.debug("Unable to get outbox for AP user: " + apUserName);
            return;
        }

        /*
         * Generate a list of known AP IDs so we can ignore them and load only the unknown ones from the
         * foreign server
         */
        HashSet<String> apIdSet = new HashSet<>();
        for (SubNode n : outboxItems) {
            String apId = n.getStrProp(NodeProp.ACT_PUB_ID.s());
            if (apId != null) {
                apIdSet.add(apId);
            }
        }

        ValContainer<Integer> count = new ValContainer<>(0);
        final SubNode _userNode = userNode;

        apUtil.iterateOrderedCollection(outbox, Integer.MAX_VALUE, obj -> {
            try {
                // if (obj != null) {
                // log.debug("saveNote: OBJ=" + XString.prettyPrint(obj));
                // }

                String apId = AP.str(obj, "id");
                if (!apIdSet.contains(apId)) {
                    Object object = AP.obj(obj, "object");

                    if (object != null) {
                        if (object instanceof String) {
                            // todo-1: handle boosts.
                            //
                            // log.debug("Not Handled: Object was a string: " + object + " in outbox item: "
                            // + XString.prettyPrint(obj));
                            // Example of what needs to be handled here is when 'obj' contains a 'boost' (retweet)
                            // {
                            // "id" : "https://dobbs.town/users/onan/statuses/105613730170001141/activity",
                            // "type" : "Announce",
                            // "actor" : "https://dobbs.town/users/onan",
                            // "published" : "2021-01-25T01:20:30Z",
                            // "to" : [ "https://www.w3.org/ns/activitystreams#Public" ],
                            // "cc" : [ "https://mastodon.sdf.org/users/stunder", "https://dobbs.town/users/onan/followers" ],
                            // "object" : "https://mastodon.sdf.org/users/stunder/statuses/105612925260202844"
                            // }
                        } //
                        else if ("Note".equals(AP.str(object, "type"))) {
                            try {
                                ActPubService.newPostsInCycle++;
                                apService.saveNote(session, _userNode, outboxNode, object, true, true);
                                count.setVal(count.getVal() + 1);
                            } catch (Exception e) {
                                // log and ignore.
                                log.error("error in saveNode()", e);
                            }
                        } else {
                            log.debug("Object type not supported: " + XString.prettyPrint(obj));
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Failes processing collection item.", e);
            }
            return (count.getVal() < ActPubService.MAX_MESSAGES);
        });
    }

    public APObj getOutbox(String url) {
        if (url == null)
            return null;
        APObj outbox = apUtil.getJson(url, new MediaType("application", "ld+json"));
        ActPubService.outboxQueryCount++;
        ActPubService.cycleOutboxQueryCount++;
        // log.debug("Outbox: " + XString.prettyPrint(outbox));
        return outbox;
    }

    public APObj generateOutbox(String userName) {
        // log.debug("Generate outbox for userName: " + userName);
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName;
        Long totalItems = getOutboxItemCount(userName, "public");

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("id", url) //
                .put("type", "OrderedCollection") //
                .put("totalItems", totalItems) //
                .put("first", url + "?page=true") //
                .put("last", url + "?min_id=0&page=true");
    }

    /*
     * userName represents the person whose outbox is being QUERIED, and the identity of the user DOING
     * the querying will come from the http header:
     * 
     * todo-1: For now we just query the PUBLIC shares from the outbox, and verify that public query
     * works before we try to figure out how to do private auth comming from specific user(s)
     */
    public Long getOutboxItemCount(final String userName, String sharedTo) {
        Long totalItems = (Long) adminRunner.run(mongoSession -> {
            long count = 0;
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode != null) {
                List<String> sharedToList = new LinkedList<>();
                sharedToList.add(sharedTo);
                count = auth.countSubGraphByAclUser(mongoSession, null, sharedToList, userNode.getOwner());
            }
            return Long.valueOf(count);
        });
        return totalItems;
    }

    /*
     * if minId=="0" that means "last page", and if minId==null it means first page
     */
    public APObj generateOutboxPage(String userName, String minId) {
        APList items = getOutboxItems(userName, "public", minId);

        // this is a self-reference url (id)
        String url = appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName + "?min_id=" + minId
                + "&page=true";

        return new APObj() //
                .put("@context", ActPubConstants.CONTEXT_STREAMS) //
                .put("partOf", appProp.getProtocolHostAndPort() + ActPubConstants.PATH_OUTBOX + "/" + userName) //
                .put("id", url) //
                .put("type", "OrderedCollectionPage") //
                .put("orderedItems", items) //
                .put("totalItems", items.size());
    }

    /*
     * todo-1: Security isn't implemented on this call yet, but the only caller to this is passing
     * "public" as 'sharedTo' so we are safe to implement this outbox currently as only able to send
     * back public info.
     */
    public APList getOutboxItems(String userName, String sharedTo, String minId) {
        String host = appProp.getProtocolHostAndPort();
        APList retItems = null;
        String nodeIdBase = host + "/app?id=";

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (userNode == null) {
                return null;
            }

            retItems = (APList) adminRunner.run(mongoSession -> {
                APList items = new APList();
                int MAX_PER_PAGE = 25;
                boolean collecting = false;

                if (minId == null) {
                    collecting = true;
                }

                List<String> sharedToList = new LinkedList<String>();
                sharedToList.add(sharedTo);

                for (SubNode child : auth.searchSubGraphByAclUser(mongoSession, null, sharedToList,
                        Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME), MAX_PER_PAGE, userNode.getOwner())) {

                    if (items.size() >= MAX_PER_PAGE) {
                        // ocPage.setPrev(outboxBase + "?page=" + String.valueOf(pgNo - 1));
                        // ocPage.setNext(outboxBase + "?page=" + String.valueOf(pgNo + 1));
                        break;
                    }

                    if (collecting) {
                        String hexId = child.getId().toHexString();
                        String published = DateUtil.isoStringFromDate(child.getModifyTime());
                        String actor = apUtil.makeActorUrlForUserName(userName);

                        items.add(new APObj() //
                                .put("id", nodeIdBase + hexId + "&create=t") //
                                .put("type", "Create") //
                                .put("actor", actor) //
                                .put("published", published) //
                                .put("to", new APList().val(ActPubConstants.CONTEXT_STREAMS + "#Public")) //
                                // .put("cc", ...) //
                                .put("object", new APObj() //
                                        .put("id", nodeIdBase + hexId) //
                                        .put("type", "Note") //
                                        .put("summary", null) //
                                        .put("replyTo", null) //
                                        .put("published", published) //
                                        .put("url", nodeIdBase + hexId) //
                                        .put("attributedTo", actor) //
                                        .put("to", new APList().val(ActPubConstants.CONTEXT_STREAMS + "#Public")) //
                                        // .put("cc", ...) //
                                        .put("sensitive", false) //
                                        .put("content", child.getContent())//
                        ));
                    }
                }

                return items;
            });

        } catch (Exception e) {
            log.error("failed generating outbox page: ", e);
            throw new RuntimeException(e);
        }
        return retItems;
    }
}
