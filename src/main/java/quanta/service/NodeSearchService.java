package quanta.service;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import quanta.actpub.ActPubService;
import quanta.config.NodePath;
import quanta.model.NodeInfo;
import quanta.model.client.Bookmark;
import quanta.model.client.Constant;
import quanta.model.client.ConstantInt;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.PrivilegeType;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoSession;
import quanta.mongo.MongoUtil;
import quanta.mongo.model.AccessControl;
import quanta.mongo.model.SubNode;
import quanta.request.GetBookmarksRequest;
import quanta.request.GetNodeStatsRequest;
import quanta.request.GetSharedNodesRequest;
import quanta.request.NodeSearchRequest;
import quanta.response.GetBookmarksResponse;
import quanta.response.GetNodeStatsResponse;
import quanta.response.GetSharedNodesResponse;
import quanta.response.NodeSearchResponse;
import quanta.util.Convert;
import quanta.util.EnglishDictionary;
import quanta.util.ExUtil;
import quanta.util.ThreadLocals;
import quanta.util.XString;

/**
 * Service for searching the repository. This searching is currently very basic, and just grabs the
 * first 100 results. Despite it being basic right now, it is however EXTREMELY high performance and
 * leverages the full and best search performance that can be gotten out of Lucene, which beats any
 * other technology in the world in it's power.
 * 
 * NOTE: the Query class DOES have a 'skip' and 'limit' which I can take advantage of in all my
 * searching but I'm not fully doing so yet I don't believe.
 */
@Lazy
@Component
public class NodeSearchService {
	private static final Logger log = LoggerFactory.getLogger(NodeSearchService.class);

	@Autowired
	@Lazy
	protected Convert convert;

	@Autowired
	protected EnglishDictionary english;

	@Autowired
	@Lazy
	protected ActPubService apub;

	@Autowired
	@Lazy
	protected NodeRenderService render;

	@Autowired
	@Lazy
	protected AdminRun arun;

	@Autowired
	@Lazy
	protected UserManagerService user;

	@Autowired
	@Lazy
	protected MongoUtil mongoUtil;

	@Autowired
	@Lazy
	protected MongoAuth auth;

	@Autowired
	@Lazy
	protected MongoRead read;

	public static Object trendingFeedInfoLock = new Object();
	public static GetNodeStatsResponse trendingFeedInfo;

	static final String SENTENCE_DELIMS = ".!?";
	// Warning: Do not add '#' or '@', those are special (see below)
	static final String WORD_DELIMS = " \n\r\t,-;:\"'`()*{}[]<>=\\/.!?&“";

	static final int TRENDING_LIMIT = 10000;

	public NodeSearchResponse search(MongoSession ms, NodeSearchRequest req) {
		NodeSearchResponse res = new NodeSearchResponse();
		ms = ThreadLocals.ensure(ms);

		String searchText = req.getSearchText();

		// if no search text OR sort order specified that's a bad request.
		if (StringUtils.isEmpty(searchText) && //
				StringUtils.isEmpty(req.getSearchType()) && //
				// note: for timelines this is called but with a sort
				StringUtils.isEmpty(req.getSortField())) {
			throw new RuntimeException("Search text or ordering required.");
		}

		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);
		int counter = 0;

		if ("node.id".equals(req.getSearchProp())) {
			SubNode node = read.getNode(ms, searchText, true);
			if (ok(node)) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, counter + 1, false, false,
						false, false);
				searchResults.add(info);
			}
		} else if ("node.name".equals(req.getSearchProp())) {
			if (ThreadLocals.getSC().isAdmin()) {
				searchText = ":" + searchText;
			} else {
				searchText = ":" + ThreadLocals.getSC().getUserName() + ":" + searchText;
			}
			SubNode node = read.getNode(ms, searchText, true);
			if (ok(node)) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, counter + 1, false, false,
						false, false);
				searchResults.add(info);
			}
		}
		// othwerwise we're searching all node properties
		else {
			/* USER Search */
			if (Constant.SEARCH_TYPE_USER_FOREIGN.s().equals(req.getSearchType()) || //
					Constant.SEARCH_TYPE_USER_LOCAL.s().equals(req.getSearchType()) || //
					Constant.SEARCH_TYPE_USER_ALL.s().equals(req.getSearchType())) {
				userSearch(ms, req, searchResults);
			}
			// else we're doing a normal subgraph search for the text
			else {
				SubNode searchRoot = read.getNode(ms, req.getNodeId());

				if ("timeline".equals(req.getSearchDefinition())) {
					ThreadLocals.getSC().setTimelinePath(searchRoot.getPath());
				}

				for (SubNode node : read.searchSubGraph(ms, searchRoot, req.getSearchProp(), searchText, req.getSortField(),
						req.getSortDir(), ConstantInt.ROWS_PER_PAGE.val(), ConstantInt.ROWS_PER_PAGE.val() * req.getPage(),
						req.getFuzzy(), req.getCaseSensitive(), req.getTimeRangeType(), req.isRecursive(),
						req.isRequirePriority())) {
					try {
						auth.auth(ms, node, PrivilegeType.READ);
						NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, counter + 1, false,
								false, false, false);
						searchResults.add(info);
					} catch (Exception e) {
						ExUtil.error(log, "Failed converting node", e);
					}
				}
			}
		}

		res.setSuccess(true);
		return res;
	}

	private void userSearch(MongoSession ms, NodeSearchRequest req, List<NodeInfo> searchResults) {
		String findUserName = null;
		int counter = 0;

		TextCriteria textCriteria = null;
		if (!StringUtils.isEmpty(req.getSearchText())) {
			findUserName = req.getSearchText();
			textCriteria = TextCriteria.forDefaultLanguage();

			// make sure name is quoted for exact search, since it will contain delimiters
			// which would other wise mess up a search
			String name = findUserName;
			if (!name.startsWith("\"")) {
				name = "\"" + name;
			}
			if (!name.endsWith("\"")) {
				name = name + "\"";
			}
			textCriteria.matching(name);
			textCriteria.caseSensitive(req.getCaseSensitive());
		}

		Criteria moreCriteria = null;
		// searching only Foreign users
		if (Constant.SEARCH_TYPE_USER_FOREIGN.s().equals(req.getSearchType())) {
			moreCriteria = Criteria.where(SubNode.PROPERTIES + "." + NodeProp.ACT_PUB_ACTOR_URL.s() + ".value").ne(null);
		}
		// searching only Local users
		else if (Constant.SEARCH_TYPE_USER_LOCAL.s().equals(req.getSearchType())) {
			moreCriteria = Criteria.where(SubNode.PROPERTIES + "." + NodeProp.ACT_PUB_ACTOR_URL.s() + ".value").is(null);
		}

		Iterable<SubNode> accountNodes = read.getChildrenUnderPath(ms, NodePath.ROOT_OF_ALL_USERS, null,
				ConstantInt.ROWS_PER_PAGE.val(), ConstantInt.ROWS_PER_PAGE.val() * req.getPage(), textCriteria, moreCriteria);
		/*
		 * scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
		 * amount).
		 */
		for (SubNode node : accountNodes) {
			try {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, counter + 1, false, false,
						false, false);
				searchResults.add(info);
			} catch (Exception e) {
				ExUtil.error(log, "faild converting user node", e);
			}
		}

		/*
		 * If we didn't find any results and we aren't searching locally only then try to look this up as a
		 * username
		 */
		if (searchResults.size() == 0 && !Constant.SEARCH_TYPE_USER_LOCAL.s().equals(req.getSearchType())) {
			findUserName = findUserName.replace("\"", "");
			findUserName = XString.stripIfStartsWith(findUserName, "@");
			final String _findUserName = findUserName;
			arun.run(as -> {
				SubNode userNode = apub.getAcctNodeByUserName(as, _findUserName);
				if (ok(userNode)) {
					try {
						NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), as, userNode, true, false, counter + 1,
								false, false, false, false);

						searchResults.add(info);
					} catch (Exception e) {
						ExUtil.error(log, "failed converting user node", e);
					}
				}
				return null;
			});
		}
	}

	public GetSharedNodesResponse getSharedNodes(MongoSession ms, GetSharedNodesRequest req) {
		GetSharedNodesResponse res = new GetSharedNodesResponse();
		ms = ThreadLocals.ensure(ms);

		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);
		int counter = 0;

		// DO NOT DELETE (may want searching under selected node as an option some day)
		// we can remove nodeId from req, because we always search from account root
		// now.
		// SubNode searchRoot = api.getNode(session, req.getNodeId());

		// search under account root only
		SubNode searchRoot = read.getNode(ms, ThreadLocals.getSC().getRootId());

		/*
		 * todo-2: Eventually we want two ways of searching here.
		 * 
		 * 1) All my shared nodes under my account,
		 * 
		 * 2) all my shared nodes globally, and the globally is done simply by passing null for the path
		 * here
		 */
		for (SubNode node : auth.searchSubGraphByAcl(ms, req.getPage() * ConstantInt.ROWS_PER_PAGE.val(), searchRoot.getPath(),
				searchRoot.getOwner(), Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME), ConstantInt.ROWS_PER_PAGE.val())) {

			if (no(node.getAc()) || node.getAc().size() == 0)
				continue;

			/*
			 * If we're only looking for shares to a specific person (or public) then check here
			 */
			if (ok(req.getShareTarget())) {

				if (!node.safeGetAc().containsKey(req.getShareTarget())) {
					continue;
				}

				// if specifically searching for rd or wr
				if (ok(req.getAccessOption())) {
					AccessControl ac = node.safeGetAc().get(req.getShareTarget());
					// log.debug("NodeId: " + node.getIdStr() + " req=" + req.getAccessOption() + " privs="
					// + ac.getPrvs());
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

			NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSC(), ms, node, true, false, counter + 1, false, false,
					false, false);
			searchResults.add(info);
		}

		res.setSuccess(true);
		// log.debug("search results count: " + counter);
		return res;
	}

	// replace #<span> with " #". This is a quick and easy way to fix the way
	// Mastodon mangles hashes in the text.
	public String fixMastodonMangles(String content) {
		if (no(content))
			return null;
		content = content.replace("#\\u003cspan\\u003e", " #");
		content = content.replace("#<span>", " #");
		content = content.replace("\\u003c", " ");
		content = content.replace("\\u003e", " ");
		return content;
	}

	public void getBookmarks(MongoSession ms, GetBookmarksRequest req, GetBookmarksResponse res) {
		List<Bookmark> bookmarks = new LinkedList<>();

		List<SubNode> bookmarksNode = user.getSpecialNodesList(ms, NodeType.BOOKMARK_LIST.s(), null, true);
		if (ok(bookmarksNode)) {
			for (SubNode bmNode : bookmarksNode) {
				String targetId = bmNode.getStr(NodeProp.TARGET_ID);
				Bookmark bm = new Bookmark();
				String shortContent = render.getFirstLineAbbreviation(bmNode.getContent(), 100);
				bm.setName(shortContent);
				bm.setId(targetId);
				bm.setSelfId(bmNode.getIdStr());
				bookmarks.add(bm);
			}
		}

		res.setSuccess(true);
		res.setBookmarks(bookmarks);
	}

	public void getNodeStats(MongoSession ms, GetNodeStatsRequest req, GetNodeStatsResponse res) {
		/*
		 * If this is the 'feed' being queried, then get the data from trendingFeedInfo (the cache), or else
		 * cache it
		 */
		synchronized (NodeSearchService.trendingFeedInfoLock) {
			if (req.isFeed() && ok(NodeSearchService.trendingFeedInfo)) {
				res.setStats(NodeSearchService.trendingFeedInfo.getStats());
				res.setTopMentions(NodeSearchService.trendingFeedInfo.getTopMentions());
				res.setTopTags(NodeSearchService.trendingFeedInfo.getTopTags());
				res.setTopWords(NodeSearchService.trendingFeedInfo.getTopWords());
				res.setSuccess(true);
				return;
			}
		}

		HashMap<String, WordStats> wordMap = new HashMap<>();
		HashMap<String, WordStats> tagMap = new HashMap<>();
		HashMap<String, WordStats> mentionMap = new HashMap<>();

		long nodeCount = 0;
		long totalWords = 0;
		Iterable<SubNode> iter = null;

		/*
		 * NOTE: This query is similar to the one in UserFeedService.java, but simpler since we don't handle
		 * a bunch of options but just the public feed query
		 */
		if (req.isFeed()) {
			/* Finds nodes that have shares to any of the people listed in sharedToAny */
			List<String> sharedToAny = new LinkedList<>();
			sharedToAny.add(PrincipalName.PUBLIC.s());

			List<Criteria> ands = new LinkedList<>();
			Query query = new Query();
			Criteria criteria =
					Criteria.where(SubNode.PATH).regex(mongoUtil.regexRecursiveChildrenOfPath(NodePath.ROOT_OF_ALL_USERS));

			// This pattern is what is required when you have multiple conditions added to a
			// single field.
			ands.add(Criteria.where(SubNode.TYPE).ne(NodeType.FRIEND.s())); //
			ands.add(Criteria.where(SubNode.TYPE).ne(NodeType.POSTS.s())); //
			ands.add(Criteria.where(SubNode.TYPE).ne(NodeType.ACT_PUB_POSTS.s()));

			List<Criteria> orCriteria = new LinkedList<>();

			// or a node that is shared to any of the sharedToAny users
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.AC + "." + share).ne(null));
			}

			ands.add(new Criteria().orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()])));
			criteria.andOperator(ands);

			query.addCriteria(criteria);
			query.with(Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME));
			query.limit(TRENDING_LIMIT);

			iter = mongoUtil.find(query);
		}
		/*
		 * Otherwise this is not a Feed Tab query but just an arbitrary node stats request, like a user
		 * running a stats request under the 'Node Info' main menu
		 */
		else {
			ms = ThreadLocals.ensure(ms);
			SubNode searchRoot = read.getNode(ms, req.getNodeId());

			Sort sort = null;
			int limit = 0;
			if (req.isTrending()) {
				sort = Sort.by(Sort.Direction.DESC, SubNode.MODIFY_TIME);
				limit = TRENDING_LIMIT;
			}

			// We pass true if this is a basic subgraph (not a Trending analysis), so that running Node Stats
			// has the side effect of cleaning out orphans.
			iter = read.getSubGraph(ms, searchRoot, sort, limit, limit == 0 ? true : false);
		}

		for (SubNode node : iter) {
			if (no(node.getContent()))
				continue;

			String content = node.getContent();
			content = fixMastodonMangles(content);

			StringTokenizer tokens = new StringTokenizer(content, WORD_DELIMS, false);
			while (tokens.hasMoreTokens()) {
				String token = tokens.nextToken().trim();

				if (!english.isStopWord(token)) {
					String lcToken = token.toLowerCase();

					// if word is a mention.
					if (token.startsWith("@")) {
						if (token.length() == 1)
							continue;

						WordStats ws = mentionMap.get(lcToken);
						if (no(ws)) {
							ws = new WordStats(token);
							mentionMap.put(lcToken, ws);
						}
						ws.count++;
					}
					// if word is a hashtag.
					else if (token.startsWith("#")) {
						if (token.endsWith("#") || token.length() == 1)
							continue;

						// ignore stuff like #1 #23
						String numCheck = token.substring(1);
						if (StringUtils.isNumeric(numCheck))
							continue;

						WordStats ws = tagMap.get(lcToken);
						if (no(ws)) {
							ws = new WordStats(token);
							tagMap.put(lcToken, ws);
						}
						ws.count++;
					}
					// ordinary word
					else {
						if (!StringUtils.isAlpha(token)) {
							continue;
						}

						WordStats ws = wordMap.get(lcToken);
						if (no(ws)) {
							ws = new WordStats(token);
							wordMap.put(lcToken, ws);
						}
						ws.count++;
					}
				}
				totalWords++;
			}
			nodeCount++;
		}

		List<WordStats> wordList = new ArrayList<>(wordMap.values());
		List<WordStats> tagList = new ArrayList<>(tagMap.values());
		List<WordStats> mentionList = new ArrayList<>(mentionMap.values());

		wordList.sort((s1, s2) -> (int) (s2.count - s1.count));
		tagList.sort((s1, s2) -> (int) (s2.count - s1.count));
		mentionList.sort((s1, s2) -> (int) (s2.count - s1.count));

		StringBuilder sb = new StringBuilder();
		sb.append("Node count: " + nodeCount + ", ");
		sb.append("Total Words: " + totalWords + ", ");
		sb.append("Unique Words: " + wordList.size());
		res.setStats(sb.toString());

		ArrayList<String> topWords = new ArrayList<>();
		res.setTopWords(topWords);
		for (WordStats ws : wordList) {
			topWords.add(ws.word); // + "," + ws.count);
			if (topWords.size() >= 100)
				break;
		}

		ArrayList<String> topTags = new ArrayList<>();
		res.setTopTags(topTags);
		for (WordStats ws : tagList) {
			topTags.add(ws.word); // + "," + ws.count);
			if (topTags.size() >= 100)
				break;
		}

		ArrayList<String> topMentions = new ArrayList<>();
		res.setTopMentions(topMentions);
		for (WordStats ws : mentionList) {
			topMentions.add(ws.word); // + "," + ws.count);
			if (topMentions.size() >= 100)
				break;
		}
		res.setSuccess(true);

		/*
		 * If this is a feed query cache it. Only will refresh every 30mins based on a @Schedule event
		 */
		if (req.isFeed()) {
			synchronized (NodeSearchService.trendingFeedInfoLock) {
				NodeSearchService.trendingFeedInfo = res;
			}
		}
	}
}
