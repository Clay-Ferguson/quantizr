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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.TextCriteria;
import org.springframework.stereotype.Component;
import org.subnode.config.NodeName;
import org.subnode.model.NodeInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
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
import opennlp.tools.util.StringUtil;

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

	static final String SENTENCE_DELIMS = ".!?";
	// Warning: Do not add '#' or '@', those are special (see below)
	static final String WORD_DELIMS = " \n\r\t,-;:\"'`()*{}[]<>=\\/.!?&“";

	public NodeSearchResponse search(MongoSession session, NodeSearchRequest req) {
		NodeSearchResponse res = new NodeSearchResponse();
		if (session == null) {
			session = ThreadLocals.getMongoSession();
		}
		int MAX_NODES = 100;

		String searchText = req.getSearchText();
		if (StringUtil.isEmpty(searchText) && //
				!req.isUserSearch() && //
				!req.isLocalUserSearch() && //
				!req.isForeignUserSearch()) {
			throw new RuntimeException("Search text required.");
		}

		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
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
			/* If we're searching just for users do this */
			if (req.isUserSearch() || req.isLocalUserSearch() || req.isForeignUserSearch()) {

				TextCriteria textCriteria = null;
				if (!StringUtil.isEmpty(req.getSearchText())) {
					textCriteria = TextCriteria.forDefaultLanguage();
					MongoRead.populateTextCriteria(textCriteria, req.getSearchText());
					textCriteria.caseSensitive(false);
				}

				Criteria moreCriteria = null;
				// searching only Foreign users
				if (req.isForeignUserSearch()) {
					moreCriteria =
							Criteria.where(SubNode.FIELD_PROPERTIES + "." + NodeProp.ACT_PUB_ACTOR_URL.s() + ".value").ne(null);
				}
				// searching only Local users
				else if (req.isLocalUserSearch()) {
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
						MAX_NODES, req.getFuzzy(), req.getCaseSensitive())) {

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

		List<NodeInfo> searchResults = new LinkedList<NodeInfo>();
		res.setSearchResults(searchResults);
		int counter = 0;

		// DO NOT DELETE (may want searching under selected node as an option some day)
		// we can remove nodeId from req, because we always search from account root now.
		// SubNode searchRoot = api.getNode(session, req.getNodeId());

		// search under account root only
		SubNode searchRoot = read.getNode(session, ThreadLocals.getSessionContext().getRootId());

		/*
		 * todo-1: Eventually we want two ways of searching here. 1) All my shared nodes under my account,
		 * 2) all my shared nodes globally, and the globally is done simply by passing null for the path
		 * here
		 */
		for (SubNode node : auth.searchSubGraphByAcl(session, searchRoot.getPath(), searchRoot.getOwner(),
				Sort.by(Sort.Direction.DESC, SubNode.FIELD_MODIFY_TIME), MAX_NODES)) {

			/*
			 * If we're only looking for shares to a specific person (or public) then check here
			 */
			if (req.getShareTarget() != null && !node.safeGetAc().containsKey(req.getShareTarget())) {
				continue;
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

	// replace #<span> with " #". This is a quick and dirty way to fix the way Mastodon mangles hashes
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
		MongoSession session = ThreadLocals.getMongoSession();
		SubNode searchRoot = read.getNode(session, req.getNodeId());
		HashMap<String, WordStats> wordMap = new HashMap<String, WordStats>();
		HashMap<String, WordStats> tagMap = new HashMap<String, WordStats>();
		HashMap<String, WordStats> mentionMap = new HashMap<String, WordStats>();

		long nodeCount = 0;
		long totalWords = 0;

		Iterable<SubNode> iter = read.getSubGraph(session, searchRoot);
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
		List<WordStats> wordList = new ArrayList<WordStats>(wordMap.values());
		List<WordStats> tagList = new ArrayList<WordStats>(tagMap.values());
		List<WordStats> mentionList = new ArrayList<WordStats>(mentionMap.values());

		Collections.sort(wordList, new Comparator<WordStats>() {
			@Override
			public int compare(WordStats s1, WordStats s2) {
				return (int) (s2.count - s1.count);
			}
		});

		Collections.sort(tagList, new Comparator<WordStats>() {
			@Override
			public int compare(WordStats s1, WordStats s2) {
				return (int) (s2.count - s1.count);
			}
		});

		Collections.sort(mentionList, new Comparator<WordStats>() {
			@Override
			public int compare(WordStats s1, WordStats s2) {
				return (int) (s2.count - s1.count);
			}
		});

		StringBuilder sb = new StringBuilder();
		sb.append("Node count: " + nodeCount + ", ");
		sb.append("Total Words: " + totalWords + ", ");
		sb.append("Unique Words: " + wordList.size());
		res.setStats(sb.toString());

		analyzeSentences(session, searchRoot, res, wordMap, 10);

		ArrayList<String> topWords = new ArrayList<String>();
		res.setTopWords(topWords);
		for (WordStats ws : wordList) {
			topWords.add(ws.word); // + "," + ws.count);
			if (topWords.size() >= 200)
				break;
		}

		ArrayList<String> topTags = new ArrayList<String>();
		res.setTopTags(topTags);
		for (WordStats ws : tagList) {
			topTags.add(ws.word); // + "," + ws.count);
			if (topTags.size() >= 200)
				break;
		}

		ArrayList<String> topMentions = new ArrayList<String>();
		res.setTopMentions(topMentions);
		for (WordStats ws : mentionList) {
			topMentions.add(ws.word); // + "," + ws.count);
			if (topMentions.size() >= 200)
				break;
		}

		res.setSuccess(true);
	}

	/*
	 * This uses a very simple statistics algorithm to extract the top 10 most important sentences in a
	 * text, by summing the weightings of each word in any sentence according to how frequent that word
	 * is in the whole body of the text. Since we are just using 'getSubGraph' which doesn't guarantee
	 * good ordering the synthetic text of actual sentences will not be in the order they appear on the
	 * actual nodes.
	 */
	public void analyzeSentences(MongoSession session, SubNode searchRoot, GetNodeStatsResponse res,
			HashMap<String, WordStats> wordMap, int maxCount) {
		ArrayList<SentenceStats> sentenceList = new ArrayList<SentenceStats>();

		Iterable<SubNode> iter = read.getSubGraph(session, searchRoot);
		int sentenceIdx = 0;
		for (SubNode node : iter) {
			if (node.getContent() == null)
				continue;

			String content = node.getContent();
			content = fixMastodonMangles(content);

			StringTokenizer sentences = new StringTokenizer(content, SENTENCE_DELIMS, false);
			while (sentences.hasMoreTokens()) {
				String sentence = sentences.nextToken().trim();
				int score = 0;

				StringTokenizer words = new StringTokenizer(sentence, WORD_DELIMS, false);
				int sentenceWordCount = 0;
				while (words.hasMoreTokens()) {
					String word = words.nextToken().trim();

					// only consider words that are all alpha characters
					if (!StringUtils.isAlpha(word)) {
						// log.debug(" ignoring: " + token);
						continue;
					}

					if (englishDictionary.isStopWord(word))
						continue;

					/*
					 * if this word is an 'important' one, tally in it's weighted contribution to the score, as the
					 * number of times that word appears in the text
					 */
					WordStats ws = wordMap.get(word.toLowerCase());
					if (ws != null) {
						score += ws.count;
					}
					sentenceWordCount++;
				}

				if (sentenceWordCount > 0) {
					sentenceList.add(new SentenceStats(sentence, score, ++sentenceIdx));
				}
			}
		}

		Collections.sort(sentenceList, new Comparator<SentenceStats>() {
			@Override
			public int compare(SentenceStats s1, SentenceStats s2) {
				return (int) (s2.score - s1.score);
			}
		});

		/*
		 * At this point we have the sentenceList ordered by rank only and not chronological of order of
		 * appearance in the text, so now we need to order in the order it appears in the text.
		 */

		ArrayList<SentenceStats> chronoList = new ArrayList<SentenceStats>();
		int count = 0;
		for (SentenceStats ss : sentenceList) {
			chronoList.add(ss);
			if (++count > maxCount)
				break;
		}

		/*
		 * sort ascending to put sentences in the order they appeared in the text. oops, the query itself
		 * doesn't return records in the proper chrono order, so only once we make the query return the text
		 * in an order will this be correct. For not it's picking the top sentences but just not presenting
		 * them in a correct order that they appear on the tree
		 */
		// Collections.sort(chronoList, new Comparator<SentenceStats>() {
		// @Override
		// public int compare(SentenceStats s1, SentenceStats s2) {
		// return (int) (s1.sentenceIdx - s2.sentenceIdx);
		// }
		// });

		ArrayList<String> list = new ArrayList<String>();
		res.setTopSentences(list);

		for (SentenceStats ss : chronoList) {
			list.add(ss.sentence + ". (score=" + ss.score + ")");
		}
	}
}
