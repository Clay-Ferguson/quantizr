package quanta.service;

import java.util.ArrayList;
import java.util.HashMap;
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
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.BreadcrumbInfo;
import quanta.model.NodeInfo;
import quanta.model.client.Bookmark;
import quanta.model.client.Constant;
import quanta.model.client.ConstantInt;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.model.client.SearchDefinition;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;
import quanta.rest.request.DeleteSearchDefRequest;
import quanta.rest.request.GetBookmarksRequest;
import quanta.rest.request.GetNodeStatsRequest;
import quanta.rest.request.GetSearchDefsRequest;
import quanta.rest.request.GetSharedNodesRequest;
import quanta.rest.request.NodeSearchRequest;
import quanta.rest.request.RenderDocumentRequest;
import quanta.rest.response.DeleteSearchDefResponse;
import quanta.rest.response.GetBookmarksResponse;
import quanta.rest.response.GetNodeStatsResponse;
import quanta.rest.response.GetSearchDefsResponse;
import quanta.rest.response.GetSharedNodesResponse;
import quanta.rest.response.HashtagInfo;
import quanta.rest.response.NodeSearchResponse;
import quanta.rest.response.RenderDocumentResponse;
import quanta.util.ExUtil;
import quanta.util.TL;
import quanta.util.XString;
import quanta.util.val.Val;

/**
 * Service for searching the repository. This searching is currently very basic, and just grabs the
 * first 100 results. Despite it being basic right now, it is however EXTREMELY high performance and
 * leverages the full and best search performance that can be gotten out of Lucene, which beats any
 * other technology in the world in it's power.
 *
 * NOTE: the Query class DOES have a 'skip' and 'limit' which I can take advantage of in all my
 * searching but I'm not fully doing so yet I don't believe.
 */
@Component
public class NodeSearchService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(NodeSearchService.class);

    /*
     * Warning: Do not add '#' or '@' to this list because we're using it to parse text for hashtags
     * and/or usernames so those characters are part of the text. Also since urls sometimes contain
     * something like "/path/#hash=" where a hashtag is used as a parameter in the url we also don't
     * want / or ? or & characters in this delimiters list, and to support hyphenated terms we don't
     * want '-' character as a delimiter either
     */
    private static final String WORD_DELIMS = " \n\r\t,;:\"'`()*{}[]<>=\\.!“";

    public RenderDocumentResponse cm_renderDocument(RenderDocumentRequest req) {
        SearchDefinition def = req.getSearchDefinition();
        if (def != null && !StringUtils.isEmpty(def.getName())) {
            saveSearchDefinition(def);
        }

        RenderDocumentResponse res = new RenderDocumentResponse();

        List<NodeInfo> results = new LinkedList<>();
        res.setSearchResults(results);
        SubNode node = svc_mongoRead.getNode(req.getRootId());
        if (node == null) {
            throw new RuntimeEx("Node not found: " + req.getRootId());
        }
        List<SubNode> nodes =
                svc_mongoRead.getFlatSubGraph(node.getIdStr(), req.isIncludeComments(), req.getSearchDefinition());
        int counter = 0;

        for (SubNode n : nodes) {
            NodeInfo info =
                    svc_convert.toNodeInfo(false, TL.getSC(), n, false, counter + 1, false, false, false, false, null);
            if (info != null) {
                results.add(info);
            }
        }
        LinkedList<BreadcrumbInfo> breadcrumbs = new LinkedList<>();
        res.setBreadcrumbs(breadcrumbs);
        svc_render.getBreadcrumbs(node, breadcrumbs);
        return res;
    }

    public NodeSearchResponse cm_search(NodeSearchRequest req) {
        SearchDefinition def = req.getSearchDefinition();
        if (def != null && !StringUtils.isEmpty(def.getName())) {
            saveSearchDefinition(def);
        }

        NodeSearchResponse res = new NodeSearchResponse();
        String searchText = def.getSearchText();

        // if no search text OR sort order specified that's a bad request.
        if (StringUtils.isEmpty(searchText) && StringUtils.isEmpty(req.getSearchType()) && //
        // note: for timelines this is called but with a sort
                StringUtils.isEmpty(def.getSortField())) {
            throw new RuntimeEx("Search text or ordering required.");
        }
        List<NodeInfo> searchResults = new LinkedList<>();
        res.setSearchResults(searchResults);
        int counter = 0;

        if ("node.id".equals(def.getSearchProp())) {
            SubNode node = svc_mongoRead.getNode(searchText);
            if (node != null) {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                        false, null);
                if (info != null) {
                    res.setNode(info);
                    searchResults.add(info);
                }
            }
        } //
        else if ("node.name".equals(def.getSearchProp())) {
            // Undocumented Feature: You can find named nodes using format ":userName:nodeName"
            if (!searchText.contains(":")) {
                if (TL.getSC().isAdmin()) {
                    searchText = ":" + searchText;
                } else {
                    searchText = ":" + TL.getSC().getUserName() + ":" + searchText;
                }
            }
            SubNode node = svc_mongoRead.getNode(searchText);
            if (node != null) {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                        false, null);
                if (info != null) {
                    res.setNode(info);
                    searchResults.add(info);
                }
            }
        }
        // othwerwise we're searching all node properties
        else {
            if (Constant.SEARCH_TYPE_LINKED_NODES.s().equals(req.getSearchType())) {
                searchLinkedNodes(req, res);
            } //
            else if (Constant.SEARCH_TYPE_RDF_SUBJECTS.s().equals(req.getSearchType())) {
                searchRdfSubjects(req, res);
            }
            // USER Search
            else if (Constant.SEARCH_TYPE_USERS.s().equals(req.getSearchType())) {
                userSearch(null, req, searchResults);
            }
            // else we're doing a normal subgraph search for the text
            else {
                SubNode searchRoot = svc_mongoRead.getNode(req.getNodeId());

                NodeInfo rootInfo = svc_convert.toNodeInfo(false, TL.getSC(), searchRoot, false, counter + 1, false,
                        false, false, false, null);
                if (rootInfo != null) {
                    res.setNode(rootInfo);
                }

                boolean adminOnly = svc_acl.isAdminOwned(searchRoot);
                if ("timeline".equals(req.getView())) {
                    TL.getSC().setTimelinePath(searchRoot.getPath());
                }

                if (req.isDeleteMatches()) {
                    /*
                     * I'm removing this until we have a way to make it share the SAME query building code as we have
                     * inside the searchSubGraph method, or else we can just iterate over the subGraph return list
                     * itself and delete one by one.
                     */
                    throw new RuntimeEx("Delete Matches not currently implemented.");
                } else {
                    for (SubNode node : svc_mongoRead.searchSubGraph(searchRoot, def.getSearchProp(), searchText,
                            def.getSortField(), def.getSortDir(), ConstantInt.ROWS_PER_PAGE.val(),
                            ConstantInt.ROWS_PER_PAGE.val() * req.getPage(), def.isFuzzy(), def.isCaseSensitive(),
                            req.getTimeRangeType(), def.isRecursive(), def.isRequirePriority(),
                            def.isRequireAttachment(), def.isRequireDate())) {
                        try {
                            NodeInfo info = svc_convert.toNodeInfo(adminOnly, TL.getSC(), node, false, counter + 1,
                                    false, false, false, false, null);
                            if (info != null) {
                                searchResults.add(info);
                            }
                        } catch (Exception e) {
                            ExUtil.error(log, "Failed converting node", e);
                        }
                    }
                }
            }
        }
        return res;
    }

    private void saveSearchDefinition(SearchDefinition def) {
        // lookup user node for the signed in user
        AccountNode userNode = svc_user.getSessionUserAccount();
        if (userNode != null) {
            @SuppressWarnings("unchecked")
            List<SearchDefinition> searchDefs =
                    (ArrayList<SearchDefinition>) userNode.getObj(NodeProp.USER_SEACH_DEFINITIONS.s(), ArrayList.class);

            if (searchDefs == null) {
                searchDefs = new ArrayList<>();
            }

            // remove nulls from the searchDefs list
            searchDefs.removeIf(sd -> sd == null);

            // replace the search definition (if one is found by name) with the new one or else add to the array
            boolean found = false;
            for (int i = 0; i < searchDefs.size(); i++) {
                SearchDefinition sd = searchDefs.get(i);
                String name = sd.getName();
                if (name != null && name.equals(def.getName())) {
                    searchDefs.set(i, def);
                    found = true;
                    break;
                }
            }
            if (!found) {
                log.debug("Saving new search definition: " + XString.prettyPrint(def));
                searchDefs.add(def);
            }
            userNode.set(NodeProp.USER_SEACH_DEFINITIONS.s(), searchDefs);
            svc_mongoUpdate.save(userNode);
        }
    }

    private void searchLinkedNodes(NodeSearchRequest req, NodeSearchResponse res) {
        SearchDefinition def = req.getSearchDefinition();
        int counter = 0;
        for (SubNode node : svc_mongoRead.getLinkedNodes(req.getNodeId(), def.getSearchText())) {
            try {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                        false, null);
                if (info != null) {
                    res.getSearchResults().add(info);
                }
            } catch (Exception e) {
                ExUtil.error(log, "Failed converting node", e);
            }
        }
    }

    private void searchRdfSubjects(NodeSearchRequest req, NodeSearchResponse res) {
        int counter = 0;
        for (SubNode node : svc_mongoRead.getRdfSubjects(req.getNodeId())) {
            try {
                NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                        false, null);
                if (info != null) {
                    res.getSearchResults().add(info);
                }
            } catch (Exception e) {
                ExUtil.error(log, "Failed converting node", e);
            }
        }
    }

    private void userSearch(String userDoingAction, NodeSearchRequest req, List<NodeInfo> searchResults) {
        SearchDefinition def = req.getSearchDefinition();
        int counter = 0;
        Val<Iterable<SubNode>> accountNodes = new Val<>();
        // Run this as admin because ordinary users don't have access to account nodes.
        svc_arun.run(() -> {
            if (def.getSearchText().startsWith("email:")) {
                String email = def.getSearchText().substring(6);
                accountNodes.setVal(svc_user.getAccountNodes(Criteria.where("p." + NodeProp.EMAIL.s()).is(email), null, //
                        ConstantInt.ROWS_PER_PAGE.val(), //
                        ConstantInt.ROWS_PER_PAGE.val() * req.getPage()));
                return null;
            } else {
                accountNodes.setVal(svc_user.getAccountNodes(
                        Criteria.where("p." + NodeProp.USER.s()).regex(def.getSearchText(), "i"), null, //
                        ConstantInt.ROWS_PER_PAGE.val(), //
                        ConstantInt.ROWS_PER_PAGE.val() * req.getPage()));
            }
            return null;
        });
        if (accountNodes.getVal() != null) {
            // scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
            // amount).
            for (SubNode node : accountNodes.getVal()) {
                try {
                    NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false,
                            false, false, null);
                    if (info != null) {
                        searchResults.add(info);
                    }
                } catch (Exception e) {
                    ExUtil.error(log, "failed converting user node", e);
                }
            }
        }
    }

    public GetSharedNodesResponse cm_getSharedNodes(GetSharedNodesRequest req) {
        GetSharedNodesResponse res = new GetSharedNodesResponse();
        List<NodeInfo> searchResults = new LinkedList<>();
        res.setSearchResults(searchResults);
        int counter = 0;
        /*
         * DO NOT DELETE (may want searching under selected node as an option some day) we can remove nodeId
         * from req, because we always search from account root now. SubNode searchRoot =
         * api.getNode(session, req.getNodeId()); search under account root only
         */
        SubNode searchRoot = svc_mongoRead.getNode(TL.getSC().getUserNodeId());
        // todo-2: Eventually we want two ways of searching here.
        //
        // 1) All my shared nodes under my account,
        //
        // 2) all my shared nodes globally, and the globally is done simply by passing null for the path
        // here
        for (SubNode node : svc_auth.searchSubGraphByAcl(req.getPage() * ConstantInt.ROWS_PER_PAGE.val(),
                searchRoot.getPath(), searchRoot.getOwner(), Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME),
                ConstantInt.ROWS_PER_PAGE.val())) {
            if (node.getAc() == null || node.getAc().size() == 0)
                continue;
            // If we're only looking for shares to a specific person (or public) then check here
            if (req.getShareTarget() != null) {
                if (!node.getAc().containsKey(req.getShareTarget())) {
                    continue;
                }
                // if specifically searching for rd or wr
                if (req.getAccessOption() != null) {
                    AccessControl ac = node.getAc().get(req.getShareTarget());
                    if (req.getAccessOption().contains(PrivilegeType.READ.s()) && //
                            (!ac.getPrvs().contains(PrivilegeType.READ.s()) || //
                                    ac.getPrvs().contains(PrivilegeType.WRITE.s()))) {
                        continue;
                    }
                    if (req.getAccessOption().contains(PrivilegeType.WRITE.s())
                            && !ac.getPrvs().contains(PrivilegeType.WRITE.s())) {
                        continue;
                    }
                }
            }
            NodeInfo info = svc_convert.toNodeInfo(false, TL.getSC(), node, false, counter + 1, false, false, false,
                    false, null);
            if (info != null) {
                searchResults.add(info);
            }
        }
        // log.debug("search results count: " + counter);
        return res;
    }

    public DeleteSearchDefResponse cm_deleteSearchDef(DeleteSearchDefRequest req) {
        DeleteSearchDefResponse res = new DeleteSearchDefResponse();
        SubNode userNode = svc_mongoRead.getNode(TL.getSC().getUserNodeId());
        if (userNode != null) {
            @SuppressWarnings("unchecked")
            List<SearchDefinition> searchDefs =
                    (ArrayList<SearchDefinition>) userNode.getObj(NodeProp.USER_SEACH_DEFINITIONS.s(), ArrayList.class);

            if (searchDefs != null) {
                // remove all nulls from searchDefs list
                searchDefs.removeIf(sd -> sd == null);
                // remove the search definition by name
                searchDefs.removeIf(sd -> sd.getName().equals(req.getSearchDefName()));

                // save back to db
                userNode.set(NodeProp.USER_SEACH_DEFINITIONS.s(), searchDefs);
                svc_mongoUpdate.save(userNode);

                // sort bookmarks by name
                searchDefs.sort((b1, b2) -> b1.getName().compareTo(b2.getName()));
                res.setSearchDefs(searchDefs);
            }
        }
        return res;
    }

    public GetSearchDefsResponse cm_getSearchDefs(GetSearchDefsRequest req) {
        GetSearchDefsResponse res = new GetSearchDefsResponse();
        SubNode userNode = svc_mongoRead.getNode(TL.getSC().getUserNodeId());
        if (userNode != null) {
            @SuppressWarnings("unchecked")
            List<SearchDefinition> searchDefs =
                    (ArrayList<SearchDefinition>) userNode.getObj(NodeProp.USER_SEACH_DEFINITIONS.s(), ArrayList.class);

            if (searchDefs != null) {
                // remove nulls from the serchDefs list
                searchDefs.removeIf(sd -> sd == null);
                // sort bookmarks by name
                searchDefs.sort((b1, b2) -> b1.getName().compareTo(b2.getName()));
                res.setSearchDefs(searchDefs);
            }
        }
        return res;
    }

    public GetBookmarksResponse cm_getBookmarks(GetBookmarksRequest req) {
        List<Bookmark> bookmarks = new LinkedList<>();
        List<SubNode> bookmarksNode = svc_user.getSpecialNodesList(null, NodeType.BOOKMARK_LIST.s(), null, true, null);
        if (bookmarksNode != null) {
            for (SubNode bmNode : bookmarksNode) {
                String targetId = bmNode.getStr(NodeProp.TARGET_ID);
                String search = bmNode.getStr(NodeProp.BOOKMARK_SEARCH_TEXT);
                Bookmark bm = new Bookmark();
                String shortContent = svc_render.getFirstLineAbbreviation(bmNode.getContent(), 100);
                bm.setName(shortContent);
                bm.setId(targetId);
                bm.setSelfId(bmNode.getIdStr());
                bm.setSearch(search);
                bookmarks.add(bm);
            }
        }

        // sort bookmarks by name
        bookmarks.sort((b1, b2) -> b1.getName().compareTo(b2.getName()));

        GetBookmarksResponse res = new GetBookmarksResponse();
        res.setBookmarks(bookmarks);
        return res;
    }

    private class Stats {
        long nodeCount = 0;
        long wordCount = 0;
        int publicCount = 0;
        int publicWriteCount = 0;
        int nonPublicCount = 0;
        int adminOwnedCount = 0;
        int userShareCount = 0;
        int signedNodeCount = 0;
        int unsignedNodeCount = 0;
        int failedSigCount = 0;
    }

    public GetNodeStatsResponse cm_getNodeStats(GetNodeStatsRequest req) {
        GetNodeStatsResponse res = new GetNodeStatsResponse();
        boolean countVotes = true;

        HashMap<String, WordStats> wordMap = req.isGetWords() ? new HashMap<>() : null;
        HashMap<String, WordStats> tagMap = req.isGetTags() ? new HashMap<>() : null;
        HashMap<String, WordStats> voteMap = countVotes ? new HashMap<>() : null;

        Stats stats = new Stats();
        Iterable<SubNode> iter = null;
        boolean strictFiltering = false;
        SubNode searchRoot = null;

        searchRoot = svc_mongoRead.getNode(req.getNodeId());
        Sort sort = null;
        iter = svc_mongoRead.getSubGraph(searchRoot, sort, 0, false, null);
        HashSet<String> uniqueUsersSharedTo = new HashSet<>();
        HashSet<ObjectId> uniqueVoters = countVotes ? new HashSet<>() : null;

        // for tree stats we need to process the root node as well because our query only gets children
        if (searchRoot != null) {
            processStatsForNode(searchRoot, req, stats, uniqueVoters, strictFiltering, uniqueUsersSharedTo, countVotes,
                    wordMap, tagMap, voteMap);
        }

        for (SubNode node : iter) {
            processStatsForNode(node, req, stats, uniqueVoters, strictFiltering, uniqueUsersSharedTo, countVotes,
                    wordMap, tagMap, voteMap);
        }

        List<WordStats> wordList = req.isGetWords() ? new ArrayList<>(wordMap.values()) : null;
        List<WordStats> tagList = req.isGetTags() ? new ArrayList<>(tagMap.values()) : null;
        List<WordStats> voteList = countVotes ? new ArrayList<>(voteMap.values()) : null;

        if (wordList != null)
            wordList.sort((s1, s2) -> (int) (s2.count - s1.count));
        if (tagList != null)
            tagList.sort((s1, s2) -> (int) (s2.count - s1.count));
        if (voteList != null)
            voteList.sort((s1, s2) -> (int) (s2.count - s1.count));

        StringBuilder sb = new StringBuilder();
        sb.append("Node count: " + stats.nodeCount + "\n");
        sb.append("Total Words: " + stats.wordCount + "\n");
        if (wordList != null) {
            sb.append("Unique Words: " + wordList.size() + "\n");
        }
        if (voteList != null) {
            sb.append("Unique Votes: " + voteList.size() + "\n");
        }

        sb.append("Non-Public: " + stats.nonPublicCount + "\n");
        sb.append("Public: " + stats.publicCount + "\n");
        sb.append("Public Writable: " + stats.publicWriteCount + "\n");
        sb.append("Admin Owned: " + stats.adminOwnedCount + "\n");
        sb.append("User Shares: " + stats.userShareCount + "\n");
        sb.append("Unique Users Shared To: " + uniqueUsersSharedTo.size() + "\n");

        if (req.isSignatureVerify()) {
            sb.append("Signed: " + stats.signedNodeCount + ", Unsigned: " + stats.unsignedNodeCount + ", FAILED SIGS: "
                    + stats.failedSigCount);
        }

        res.setStats(sb.toString());
        if (wordList != null) {
            ArrayList<String> topWords = new ArrayList<>();
            res.setTopWords(topWords);

            for (WordStats ws : wordList) {
                topWords.add(ws.word); // + "," + ws.count);
                if (topWords.size() >= 100)
                    break;
            }
        }

        if (voteList != null) {
            ArrayList<String> topVotes = new ArrayList<>();
            res.setTopVotes(topVotes);

            for (WordStats ws : voteList) {
                topVotes.add(ws.word + "(" + ws.count + ")");
                if (topVotes.size() >= 100)
                    break;
            }
        }

        if (tagList != null) {
            ArrayList<HashtagInfo> topTags = new ArrayList<>();
            res.setTopTags(topTags);

            for (WordStats ws : tagList) {
                HashtagInfo hi = new HashtagInfo();
                hi.setHashtag(ws.word);
                if (ws.usedWith != null) {
                    hi.setUsedWith(new ArrayList<>(ws.usedWith));
                }
                topTags.add(hi); // + "," + ws.count);
                if (topTags.size() >= 100)
                    break;
            }
        }
        return res;
    }

    private void processStatsForNode(SubNode node, GetNodeStatsRequest req, Stats stats, //
            HashSet<ObjectId> uniqueVoters, boolean strictFiltering, HashSet<String> uniqueUsersSharedTo,
            boolean countVotes, HashMap<String, WordStats> wordMap, HashMap<String, WordStats> tagMap,
            HashMap<String, WordStats> voteMap) {

        // set to hold all hashtags in this node only
        HashSet<String> tags = null;

        stats.nodeCount++;
        if (req.isSignatureVerify()) {
            String sig = node.getStr(NodeProp.CRYPTO_SIG);
            if (sig != null) {
                stats.signedNodeCount++;
                // we can add a node cache here to this line? third arg.
                if (!svc_crypto.nodeSigVerify(node, sig)) {
                    stats.failedSigCount++;
                }
            } else {
                // log.debug("UNSIGNED: " + XString.prettyPrint(node));
                stats.unsignedNodeCount++;
            }
        }

        // PART 1: Process sharing info
        HashMap<String, AccessControl> aclEntry = node.getAc();
        boolean isPublic = false;
        if (aclEntry != null) {
            for (String key : aclEntry.keySet()) {
                AccessControl ac = aclEntry.get(key);
                if (PrincipalName.PUBLIC.s().equals(key)) {
                    isPublic = true;
                    stats.publicCount++;
                    if (ac != null && ac.getPrvs() != null && ac.getPrvs().contains(PrivilegeType.WRITE.s())) {
                        stats.publicWriteCount++;
                    }
                } else {
                    stats.userShareCount++;
                    uniqueUsersSharedTo.add(key);
                }
            }
        }

        if (!isPublic) {
            stats.nonPublicCount++;
        }

        if (svc_acl.isAdminOwned(node)) {
            stats.adminOwnedCount++;
        }

        // PART 2: process 'content' text.
        if (node.getContent() == null)
            return;
        String content = node.getContent();
        if (node.getTags() != null) {
            content += " " + node.getTags();
        }

        StringTokenizer tokens = new StringTokenizer(content, WORD_DELIMS, false);
        while (tokens.hasMoreTokens()) {
            String token = tokens.nextToken().trim();
            if (!svc_english.isStopWord(token)) {
                String lcToken = token.toLowerCase();
                // if word is a hashtag.
                if (token.startsWith("#")) {
                    if (token.endsWith("#") || token.length() < 3)
                        continue;

                    // ignore stuff like #1 #23
                    String numCheck = token.substring(1);
                    if (StringUtils.isNumeric(numCheck))
                        continue;

                    if (tagMap != null) {
                        WordStats ws = tagMap.get(lcToken);
                        if (ws == null) {
                            ws = new WordStats(token);
                            tagMap.put(lcToken, ws);
                        }
                        if (tags == null) {
                            tags = new HashSet<>();
                        }
                        tags.add(token);
                        ws.inc(node);
                    }
                }
                // ordinary word
                else {
                    if (!StringUtils.isAlpha(token) || token.length() < 3) {
                        continue;
                    }

                    if (wordMap != null) {
                        WordStats ws = wordMap.get(lcToken);
                        if (ws == null) {
                            ws = new WordStats(token);
                            wordMap.put(lcToken, ws);
                        }
                        ws.inc(node);
                    }
                }
            }
            stats.wordCount++;
        }

        if (countVotes) {
            String vote = node.getStr(NodeProp.VOTE.s());
            if (vote != null) {
                // 'add' returns true if we are encountering this ID for the first time, so we can tally it's vote
                if (uniqueVoters.add(node.getId())) {
                    WordStats ws = voteMap.get(vote);
                    if (ws == null) {
                        ws = new WordStats(vote);
                        voteMap.put(vote, ws);
                    }
                    ws.inc(node);
                }
            }
        }

        // now process all the tags, so all of them know what other tags they are used with
        if (tags != null) {
            for (String tag : tags) {
                WordStats ws = tagMap.get(tag);
                if (ws != null) {
                    for (String otherTag : tags) {
                        if (!tag.equals(otherTag)) {
                            ws.addUsedWith(otherTag);
                        }
                    }
                }
            }
        }
    }
}
