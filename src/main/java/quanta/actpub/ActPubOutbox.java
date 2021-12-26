package quanta.actpub;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import quanta.actpub.model.AP;
import quanta.actpub.model.APList;
import quanta.actpub.model.APOCreate;
import quanta.actpub.model.APONote;
import quanta.actpub.model.APOOrderedCollection;
import quanta.actpub.model.APOOrderedCollectionPage;
import quanta.actpub.model.APObj;
import quanta.actpub.model.APType;
import quanta.config.NodeName;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.MongoSession;
import quanta.mongo.model.SubNode;
import quanta.util.DateUtil;
import quanta.util.Val;
import quanta.util.XString;

/**
 * AP Outbox
 */
@Component
public class ActPubOutbox extends ServiceBase {
    private static final Logger log = LoggerFactory.getLogger(ActPubOutbox.class);

    @PostConstruct
	public void postConstruct() {
		apOutbox = this;
	}

    /**
     * Caller can pass in userNode if it's already available, but if not just pass null and the
     * apUserName will be used to look up the userNode.
     */
    public void loadForeignOutbox(MongoSession ms, Object actor, SubNode userNode, String apUserName) {
        try {
            if (no(userNode)) {
                userNode = read.getUserNodeByUserName(ms, apUserName);
            }

            SubNode outboxNode = read.getUserNodeByType(ms, apUserName, userNode, "### Posts", NodeType.ACT_PUB_POSTS.s(),
                    Arrays.asList(PrivilegeType.READ.s(), PrivilegeType.WRITE.s()), NodeName.POSTS);
            if (no(outboxNode)) {
                log.debug("no outbox for user: " + apUserName);
                return;
            }

            /*
             * Query all existing known outbox items we have already saved for this foreign user
             */
            Iterable<SubNode> outboxItems = read.getSubGraph(ms, outboxNode, null, 0, true);
            String outboxUrl = AP.str(actor, APObj.outbox);
            APObj outbox = getOutbox(outboxUrl);
            if (no(outbox)) {
                log.debug("Unable to get outbox for AP user: " + apUserName);
                return;
            }

            /*
             * Generate a list of known AP IDs so we can ignore them and load only the unknown ones from the
             * foreign server
             */
            HashSet<String> apIdSet = new HashSet<>();
            for (SubNode n : outboxItems) {
                String apId = n.getStr(NodeProp.ACT_PUB_ID.s());
                if (ok(apId)) {
                    apIdSet.add(apId);
                }
            }

            Val<Integer> count = new Val<>(0);
            final SubNode _userNode = userNode;

            // log.debug("scanning outbox orderedCollection");
            apUtil.iterateOrderedCollection(outbox, Integer.MAX_VALUE, obj -> {
                try {
                    // if (ok(obj )) {
                    // log.debug("orderedCollection Item: OBJ=" + XString.prettyPrint(obj));
                    // }

                    String apId = AP.str(obj, APObj.id);

                    // If this is a new post our server hasn't yet injested.
                    if (!apIdSet.contains(apId)) {
                        Object object = AP.obj(obj, APObj.object);

                        if (ok(object)) {
                            if (object instanceof String) {
                                // todo-1: handle boosts.
                                //
                                // log.debug("Not Handled: Object was a string: " + object + " in outbox item: "
                                // + XString.prettyPrint(obj));
                                // Example of what needs to be handled here is when 'obj' contains a 'boost' (retweet)
                                // {
                                // "id" : "https://dobbs.town/users/onan/statuses/105613730170001141/activity",
                                // AP.type : "Announce",
                                // AP.actor : "https://dobbs.town/users/onan",
                                // AP.published : "2021-01-25T01:20:30Z",
                                // AP.to : [ "https://www.w3.org/ns/activitystreams#Public" ],
                                // "cc" : [ "https://mastodon.sdf.org/users/stunder", "https://dobbs.town/users/onan/followers" ],
                                // AP.object : "https://mastodon.sdf.org/users/stunder/statuses/105612925260202844"
                                // }
                            } //
                            else if (AP.isType(object, APType.Note)) {
                                try {
                                    ActPubService.newPostsInCycle++;
                                    apub.saveNote(ms, _userNode, outboxNode, object, false, true);
                                    count.setVal(count.getVal() + 1);
                                } catch (Exception e) {
                                    // log and ignore.
                                    log.error("error in saveNode()", e);
                                }
                            } else {
                                // this captures videos? and other things (todo-1: add more support)
                                // log.debug("Object type not supported: " + XString.prettyPrint(obj));
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("Failes processing collection item.", e);
                }
                return (count.getVal() < ActPubService.MAX_MESSAGES);
            });
        } catch (Exception e) {
            log.error("Error reading outbox of: " + apUserName, e);
        }
    }

    public APObj getOutbox(String url) {
        if (no(url))
            return null;

        APObj outbox = apUtil.getJson(url, APConst.MTYPE_ACT_JSON);
        ActPubService.outboxQueryCount++;
        ActPubService.cycleOutboxQueryCount++;
        apUtil.log("Outbox [" + url + "]\n" + XString.prettyPrint(outbox));
        return outbox;
    }

    public APOOrderedCollection generateOutbox(String userName) {
        // log.debug("Generate outbox for userName: " + userName);
        String url = prop.getProtocolHostAndPort() + APConst.PATH_OUTBOX + "/" + userName;
        Long totalItems = getOutboxItemCount(userName, PrincipalName.PUBLIC.s());

        APOOrderedCollection ret = new APOOrderedCollection(url, totalItems, url + "?page=true", //
                url + "?min_id=0&page=true");
        return ret;
    }

    /*
     * userName represents the person whose outbox is being QUERIED, and the identity of the user DOING
     * the querying will come from the http header:
     * 
     * todo-1: For now we just query the PUBLIC shares from the outbox, and verify that public query
     * works before we try to figure out how to do private auth comming from specific user(s)
     */
    public Long getOutboxItemCount(String userName, String sharedTo) {
        Long totalItems = arun.run(as -> {
            long count = 0;
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (ok(userNode)) {
                List<String> sharedToList = new LinkedList<>();
                sharedToList.add(sharedTo);
                count = auth.countSubGraphByAclUser(as, null, sharedToList, userNode.getOwner());
            }
            return Long.valueOf(count);
        });
        return totalItems;
    }

    /*
     * if minId=="0" that means "last page", and if minId==null it means first page
     */
    public APOOrderedCollectionPage generateOutboxPage(String userName, String minId) {
        APList items = getOutboxItems(userName, minId);

        // this is a self-reference url (id)
        String url = prop.getProtocolHostAndPort() + APConst.PATH_OUTBOX + "/" + userName + "?min_id=" + minId + "&page=true";

        APOOrderedCollectionPage ret = new APOOrderedCollectionPage(url, items,
                prop.getProtocolHostAndPort() + APConst.PATH_OUTBOX + "/" + userName, items.size());
        return ret;
    }

    public APList getOutboxItems(String userName, String minId) {
        /*
         * For now we only support retrieving public nodes here but we need to do the proper thing here
         * eventually to adhere to the ActivityPub spec regarding authenticating what user is calling this
         */
        String sharedTo = PrincipalName.PUBLIC.s();

        String host = prop.getProtocolHostAndPort();
        APList retItems = null;
        String nodeIdBase = host + "/app?id=";

        try {
            SubNode userNode = read.getUserNodeByUserName(null, userName);
            if (no(userNode)) {
                return null;
            }

            retItems = (APList) arun.run(as -> {
                APList items = new APList();
                int MAX_PER_PAGE = 25;
                boolean collecting = false;

                if (no(minId)) {
                    collecting = true;
                }

                List<String> sharedToList = new LinkedList<String>();
                sharedToList.add(sharedTo);

                for (SubNode child : auth.searchSubGraphByAclUser(as, null, sharedToList,
                        Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME), MAX_PER_PAGE, userNode.getOwner())) {

                    String replyTo = null;
                    SubNode parent = read.getParent(as, child, false);
                    if (ok(parent)) {
                        replyTo = snUtil.getIdBasedUrl(parent);
                    }

                    if (items.size() >= MAX_PER_PAGE) {
                        // ocPage.setPrev(outboxBase + "?page=" + String.valueOf(pgNo - 1));
                        // ocPage.setNext(outboxBase + "?page=" + String.valueOf(pgNo + 1));
                        break;
                    }

                    if (collecting) {
                        String hexId = child.getIdStr();
                        String published = DateUtil.isoStringFromDate(child.getModifyTime());
                        String actor = apUtil.makeActorUrlForUserName(userName);

                        APONote note = new APONote(nodeIdBase + hexId, published, actor, null, nodeIdBase + hexId, false,
                                child.getContent(), new APList().val(APConst.CONTEXT_STREAMS_PUBLIC));

                        if (ok(replyTo)) {
                            note = note.put(APObj.inReplyTo, replyTo);
                        }

                        items.add(new APOCreate(
                                // todo-1: what is the create=t here? That was part of my own temporary test right?
                                nodeIdBase + hexId + "&create=t", actor, published, note,
                                new APList().val(APConst.CONTEXT_STREAMS_PUBLIC)));
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
