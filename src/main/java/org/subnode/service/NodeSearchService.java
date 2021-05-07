package org.subnode.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.StringTokenizer;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import org.subnode.config.NodeName;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.NodeType;
import org.subnode.model.client.PrivilegeType;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.MongoUtil;
import org.subnode.mongo.model.AccessControl;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetNodeStatsRequest;
import org.subnode.request.GetSharedNodesRequest;
import org.subnode.request.NodeSearchRequest;
import org.subnode.response.GetNodeStatsResponse;
import org.subnode.response.GetSharedNodesResponse;
import org.subnode.response.NodeSearchResponse;
import org.subnode.util.Convert;
import org.subnode.util.EnglishDictionary;
import org.subnode.util.ThreadLocals;

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
public class NodeSearchService {
	private static final Logger log = LoggerFactory.getLogger(NodeSearchService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private MongoAuth auth;

	@Autowired
	private Convert convert;

	@Autowired
	private EnglishDictionary englishDictionary;

	@Autowired
	private MongoTemplate ops;

	@Autowired
	private MongoUtil util;

	public static Object trendingFeedInfoLock = new Object();
	public static GetNodeStatsResponse trendingFeedInfo;

	static final String SENTENCE_DELIMS = ".!?";
	// Warning: Do not add '#' or '@', those are special (see below)
	static final String WORD_DELIMS = " \n\r\t,-;:\"'`()*{}[]<>=\\/.!?&“";

	static final int TRENDING_LIMIT = 500;

	public NodeSearchResponse search(MongoSession session, NodeSearchRequest req) {
		NodeSearchResponse res = new NodeSearchResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;

		String searchText = req.getSearchText();
		if (StringUtils.isEmpty(searchText) && //
				StringUtils.isEmpty(req.getUserSearchType()) && //
				// note: for timelines this is called but with a sort
				StringUtils.isEmpty(req.getSortField())) {
			throw new RuntimeException("Search text required.");
		}

		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);
		int counter = 0;

		if ("node.id".equals(req.getSearchProp())) {
			SubNode node = read.getNode(session, searchText, true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
						counter + 1, false, false);
				searchResults.add(info);
			}
		} else if ("node.name".equals(req.getSearchProp())) {
			if (ThreadLocals.getSessionContext().isAdmin()) {
				searchText = ":" + searchText;
			} else {
				searchText = ":" + ThreadLocals.getSessionContext().getUserName() + ":" + searchText;
			}
			SubNode node = read.getNode(session, searchText, true);
			if (node != null) {
				NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
						counter + 1, false, false);
				searchResults.add(info);
			}
		}
		// othwerwise we're searching all node properties
		else {
			/* If we're searching just for users do this. */
			if (!StringUtils.isEmpty(req.getUserSearchType())) {

				TextCriteria textCriteria = null;
				if (!StringUtils.isEmpty(req.getSearchText())) {
					textCriteria = TextCriteria.forDefaultLanguage();
					textCriteria.matching(req.getSearchText());
					textCriteria.caseSensitive(req.getCaseSensitive());
				}

				Criteria moreCriteria = null;
				// searching only Foreign users
				if ("foreign".equals(req.getUserSearchType())) {
					moreCriteria =
							Criteria.where(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_ACTOR_URL.s() + ".value").ne(null);
				}
				// searching only Local users
				else if ("local".equals(req.getUserSearchType())) {
					moreCriteria =
							Criteria.where(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_ACTOR_URL.s() + ".value").is(null);
				}

				final Iterable<SubNode> accountNodes = read.getChildrenUnderParentPath(session, NodeName.ROOT_OF_ALL_USERS, null,
						null, 0, textCriteria, moreCriteria);
				/*
				 * scan all userAccountNodes, and set a zero amount for those not found (which will be the correct
				 * amount).
				 */
				for (final SubNode node : accountNodes) {
					NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
							counter + 1, false, false);
					searchResults.add(info);
					if (counter++ > MAX_NODES) {
						break;
					}
				}
			}
			// else we're doing a normal subgraph search for the text
			else {
				SubNode searchRoot = read.getNode(session, req.getNodeId());
				for (SubNode node : read.searchSubGraph(session, searchRoot, req.getSearchProp(), searchText, req.getSortField(),
						MAX_NODES, req.getFuzzy(), req.getCaseSensitive(), req.getTimeRangeType())) {

					NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false,
							counter + 1, false, false);
					searchResults.add(info);
					if (counter++ > MAX_NODES) {
						break;
					}
				}
			}
		}

		res.setSuccess(true);
		return res;
	}

	public GetSharedNodesResponse getSharedNodes(MongoSession session, GetSharedNodesRequest req) {
		GetSharedNodesResponse res = new GetSharedNodesResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;

		List<NodeInfo> searchResults = new LinkedList<>();
		res.setSearchResults(searchResults);
		int counter = 0;

		// DO NOT DELETE (may want searching under selected node as an option some day)
		// we can remove nodeId from req, because we always search from account root
		// now.
		// SubNode searchRoot = api.getNode(session, req.getNodeId());

		// search under account root only
		SubNode searchRoot = read.getNode(session, ThreadLocals.getSessionContext().getRootId());

		/*
		 * todo-2: Eventually we want two ways of searching here.
		 * 
		 * 1) All my shared nodes under my account,
		 * 
		 * 2) all my shared nodes globally, and the globally is done simply by passing null for the path
		 * here
		 */
		for (SubNode node : auth.searchSubGraphByAcl(session, searchRoot.getPath(), searchRoot.getOwner(),
				Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME), MAX_NODES)) {

			if (node.getAc() == null || node.getAc().size() == 0)
				continue;

			/*
			 * If we're only looking for shares to a specific person (or public) then check here
			 */
			if (req.getShareTarget() != null) {

				if (!node.safeGetAc().containsKey(req.getShareTarget())) {
					continue;
				}

				// if specifically searching for rd or wr
				if (req.getAccessOption() != null) {
					AccessControl ac = node.safeGetAc().get(req.getShareTarget());
					// log.debug("NodeId: " + node.getId().toHexString() + " req=" + req.getAccessOption() + " privs="
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

			NodeInfo info = convert.convertToNodeInfo(ThreadLocals.getSessionContext(), session, node, true, false, counter + 1,
					false, false);
			searchResults.add(info);
			if (counter++ > MAX_NODES) {
				break;
			}
		}

		res.setSuccess(true);
		log.debug("search results count: " + counter);
		return res;
	}

	// replace #<span> with " #". This is a quick and dirty way to fix the way
	// Mastodon mangles hashes
	// in the text.
	public String fixMastodonMangles(String content) {
		if (content == null)
			return null;
		content = content.replace("#\\u003cspan\\u003e", " #");
		content = content.replace("#<span>", " #");
		content = content.replace("\\u003c", " ");
		content = content.replace("\\u003e", " ");
		log.debug("unmangled content: " + content);
		return content;
	}

	public void getNodeStats(GetNodeStatsRequest req, GetNodeStatsResponse res) {

		/*
		 * If this is the 'feed' being queried, then get the data from trendingFeedInfo (the cache), or else
		 * cache it
		 */
		synchronized (NodeSearchService.trendingFeedInfoLock) {
			if (req.isFeed() && NodeSearchService.trendingFeedInfo != null) {
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
			sharedToAny.add("public");

			String pathToSearch = NodeName.ROOT_OF_ALL_USERS;

			Query query = new Query();
			Criteria criteria = Criteria.where(SubNode.FIELD_PATH).regex(util.regexRecursiveChildrenOfPath(pathToSearch)) //

					// This pattern is what is required when you have multiple conditions added to a
					// single field.
					.andOperator(Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.FRIEND.s()), //
							Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.POSTS.s()), //
							Criteria.where(SubNode.FIELD_TYPE).ne(NodeType.ACT_PUB_POSTS.s()));

			List<Criteria> orCriteria = new LinkedList<Criteria>();

			// or a node that is shared to any of the sharedToAny users
			for (String share : sharedToAny) {
				orCriteria.add(Criteria.where(SubNode.FIELD_AC + "." + share).ne(null));
			}

			criteria.orOperator((Criteria[]) orCriteria.toArray(new Criteria[orCriteria.size()]));

			query.addCriteria(criteria);
			query.with(Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME));
			query.limit(TRENDING_LIMIT);

			iter = util.find(query);
		}
		/*
		 * Otherwise this is not a Feed Tab query but just an arbitrary node stats request, like a user
		 * running a stats request under the 'Node Info' main menu
		 */
		else {
			MongoSession session = ThreadLocals.getMongoSession();
			SubNode searchRoot = read.getNode(session, req.getNodeId());

			Sort sort = null;
			int limit = 0;
			if (req.isTrending()) {
				sort = Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME);
				limit = TRENDING_LIMIT;
			}

			iter = read.getSubGraph(session, searchRoot, sort, limit);
		}

		for (SubNode node : iter) {
			if (node.getContent() == null)
				continue;

			String content = node.getContent();
			content = fixMastodonMangles(content);

			StringTokenizer tokens = new StringTokenizer(content, WORD_DELIMS, false);
			while (tokens.hasMoreTokens()) {
				String token = tokens.nextToken().trim();

				if (!englishDictionary.isStopWord(token)) {
					String lcToken = token.toLowerCase();

					// if word is a mention.
					if (token.startsWith("@")) {
						if (token.length() == 1)
							continue;

						WordStats ws = mentionMap.get(lcToken);
						if (ws == null) {
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
						if (ws == null) {
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
						if (ws == null) {
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
			if (topWords.size() >= 200)
				break;
		}

		ArrayList<String> topTags = new ArrayList<>();
		res.setTopTags(topTags);
		for (WordStats ws : tagList) {
			topTags.add(ws.word); // + "," + ws.count);
			if (topTags.size() >= 200)
				break;
		}

		ArrayList<String> topMentions = new ArrayList<>();
		res.setTopMentions(topMentions);
		for (WordStats ws : mentionList) {
			topMentions.add(ws.word); // + "," + ws.count);
			if (topMentions.size() >= 200)
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
