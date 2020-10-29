package org.subnode.service;

import java.io.Writer;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;

import com.rometools.rome.feed.synd.SyndContent;
import com.rometools.rome.feed.synd.SyndContentImpl;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndEntryImpl;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.feed.synd.SyndFeedImpl;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.SyndFeedOutput;
import com.rometools.rome.io.XmlReader;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.subnode.AppServer;
import org.subnode.config.AppProp;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.model.NodeMetaInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.ExUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.XString;

/* Proof of Concept RSS Publishing */
@Component
public class RSSFeedService {
	private static final Logger log = LoggerFactory.getLogger(RSSFeedService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private SubNodeUtil subNodeUtil;

	@Autowired
	private AppProp appProp;

	@Autowired
	private RunAsMongoAdmin adminRunner;

	private static boolean refreshingCache = false;

	/*
	 * Cache of all feeds.
	 */
	private static final HashMap<String, SyndFeed> feedCache = new HashMap<String, SyndFeed>();

	/*
	 * Cache of all feeds that are a core publication of the portal (that is part of portal pages)
	 */
	private static final HashMap<String, SyndFeed> portalCache = new HashMap<String, SyndFeed>();

	private static int runCount = 0;

	/*
	 * Runs immediately at startup, and then every 240 minutes, to refresh the
	 * feedCache.
	 */
	@Scheduled(fixedDelay = 240 * 60 * 1000)
	public void run() {
		runCount++;
		if (runCount == 1) {
			startupPreCache();
			return;
		}

		if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
			log.debug("ignoring RSSFeedService schedule cycle");
			return;
		}

		log.debug("RSSFeedService.refreshFeedCache");
		refreshFeedCache();
		portalCache.clear();
	}

	public void startupPreCache() {
		String rssNodeId = appProp.getRssAggregatePreCacheNodeId();
		if (StringUtils.isEmpty(rssNodeId))
			return;

		adminRunner.run(mongoSession -> {
			log.debug("startupPreCache: node=" + rssNodeId);
			multiRss(mongoSession, rssNodeId, null);
		});
	}

	public String refreshFeedCache() {
		if (refreshingCache) {
			return "Cache refresh was already in progress.";
		}

		try {
			refreshingCache = true;
			SyndFeed feed = null;
			int count = 0, fails = 0;

			for (String url : feedCache.keySet()) {
				try {
					feed = getFeed(url);
					count++;

					synchronized (feedCache) {
						feedCache.put(url, feed);
					}
				} catch (Exception e) {
					fails++;
					ExUtil.error(log, "Error reading feed: " + url, e);
					synchronized (feedCache) {
						feedCache.remove(url);
					}
				}
			}
			return "Refreshed " + String.valueOf(count) + " feeds. (Fail Count: " + String.valueOf(fails) + ")";
		} finally {
			refreshingCache = false;
		}
	}

	/*
	 * Streams back an RSS feed that is an aggregate feed of all the children under
	 * nodeId (recursively!) that have an RSS_FEED_SRC property
	 * 
	 * If writer is null it means we are just running without writing to a server
	 * like only to prewarm the cache during app startup called from startupPreCache
	 */
	public void multiRss(MongoSession mongoSession, final String nodeId, Writer writer) {

		// will be true if this is the IDW node for example on quanta.wiki. The
		// system-defined published aggregate, of which
		// right now we only support one.
		boolean portalAggregate = nodeId.equals(appProp.getRssAggregatePreCacheNodeId());

		SyndFeed feed = portalAggregate ? portalCache.get(nodeId) : null;

		// if we didn't find in the cache built the feed
		if (feed == null) {
			SubNode node = null;
			try {
				node = read.getNode(mongoSession, nodeId);
			} catch (NodeAuthFailedException e) {
				return;
			}

			feed = new SyndFeedImpl();

			feed.setEncoding("UTF-8");
			feed.setFeedType("rss_2.0");
			feed.setTitle("");
			feed.setDescription("");
			feed.setAuthor("");
			feed.setLink("");

			List<SyndEntry> entries = new ArrayList<SyndEntry>();
			feed.setEntries(entries);
			List<String> urls = new LinkedList<String>();

			final Iterable<SubNode> iter = read.getSubGraph(mongoSession, node);
			final List<SubNode> children = read.iterateToList(iter);

			// Scan to collect all the urls.
			if (children != null) {
				for (final SubNode n : children) {
					/* avoid infinite recursion here! */
					if (n.getId().toHexString().equals(nodeId))
						continue;

					String feedSrc = n.getStringProp(NodeProp.RSS_FEED_SRC.s());
					if (!StringUtils.isEmpty(feedSrc) && !feedSrc.contains(nodeId)) {
						urls.add(feedSrc);
					}
				}
			}

			readUrls(urls, entries);

			if (portalAggregate) {
				portalCache.put(nodeId, feed);
			}
		}

		writeFeed(feed, writer);
	}

	public void readUrls(List<String> urls, List<SyndEntry> entries) {
		for (String url : urls) {
			try {
				List<SyndEntry> feedEntries = null;
				synchronized (feedCache) {
					SyndFeed f = feedCache.get(url);
					if (f != null) {
						feedEntries = f.getEntries();
					}
				}

				if (feedEntries == null) {
					log.debug("Reading Feed: " + url);
					SyndFeed inFeed = getFeed(url);
					feedEntries = inFeed.getEntries();
					synchronized (feedCache) {
						feedCache.put(url, inFeed);
					}
				}

				entries.addAll(feedEntries);
			} catch (Exception e) {
				ExUtil.error(log, "Feed Error: ", e);
				// let one feed fail and not blow up the rest, so do not rethros
			}
		}
		revChronSortEntries(entries);
	}

	public SyndFeed getFeed(String url) {
		try {
			URL inputUrl = new URL(url);
			SyndFeedInput input = new SyndFeedInput();
			SyndFeed inFeed = input.build(new XmlReader(inputUrl));

			revChronSortEntries(inFeed.getEntries());

			if (!StringUtils.isEmpty(inFeed.getTitle())) {

				/*
				 * this number has to be as large at least as the number the browser will try to
				 * show currently, because the aggregator code is sharing this object with the
				 * ordinary single RSS feed retrival and so this number chops it down. Need to
				 * rethink this, and only chop down what the aggreggator is working with
				 */
				if (inFeed.getEntries().size() > 50) {
					inFeed.setEntries(inFeed.getEntries().subList(0, 50));
				}

				// Prefix each Title with the Feed Title so they can be distinguished when
				// rendered in browser.
				for (SyndEntry entry : inFeed.getEntries()) {
					entry.setTitle(inFeed.getTitle() + ": " + entry.getTitle());
				}
			}
			return inFeed;
		} catch (Exception e) {
			ExUtil.error(log, "Error: ", e);
			return null;
		}
	}

	public void revChronSortEntries(List<SyndEntry> entries) {
		Collections.sort(entries, new Comparator<SyndEntry>() {
			@Override
			public int compare(SyndEntry s1, SyndEntry s2) {
				if (s1.getPublishedDate() == null && s2.getPublishedDate() == null) {
					return 0;
				}

				if (s1.getPublishedDate() == null) {
					return 1;
				}

				if (s2.getPublishedDate() == null) {
					return 1;
				}

				return s2.getPublishedDate().compareTo(s1.getPublishedDate());
			}
		});
	}

	/*
	 * Takes a newline delimited list of rss feed urls, and returns the feed for
	 * them as an aggregate while also updating our caching
	 */
	public void multiRssFeed(String urls, Writer writer) {

		List<String> urlList = XString.tokenize(urls, "\n", true);
		SyndFeed feed = null;

		/* If multiple feeds we build an aggregate */
		if (urlList.size() > 1) {
			feed = new SyndFeedImpl();

			feed.setEncoding("UTF-8");
			feed.setFeedType("rss_2.0");
			feed.setTitle("");
			feed.setDescription("");
			feed.setAuthor("");
			feed.setLink("");
			List<SyndEntry> entries = new ArrayList<SyndEntry>();
			feed.setEntries(entries);
			readUrls(urlList, entries);
			writeFeed(feed, writer);
		}
		/* If not an aggregate return the one external feed itself */
		else {
			String url = urlList.get(0);

			// todo-0: wrap the cache check/update INSIDE the getFeed method?
			synchronized (feedCache) {
				feed = feedCache.get(url);
			}

			if (feed == null) {
				log.debug("Reading Feed: " + url);
				feed = getFeed(url);
				synchronized (feedCache) {
					feedCache.put(url, feed);
				}
			}
		}

		writeFeed(feed, writer);
	}

	public void getRssFeed(MongoSession mongoSession, String nodeId, Writer writer) {
		SubNode node = null;
		try {
			node = read.getNode(mongoSession, nodeId);
		} catch (NodeAuthFailedException e) {
			return;
		}

		SyndFeed feed = new SyndFeedImpl();
		feed.setEncoding("UTF-8");
		feed.setFeedType("rss_2.0");

		NodeMetaInfo metaInfo = subNodeUtil.getNodeMetaInfo(node);
		feed.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "");
		feed.setLink("");
		feed.setDescription(metaInfo.getDescription() != null ? metaInfo.getDescription() : "");

		List<SyndEntry> entries = new LinkedList<SyndEntry>();
		feed.setEntries(entries);

		final Iterable<SubNode> iter = read.getChildren(mongoSession, node,
				Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		if (children != null) {
			for (final SubNode n : children) {
				metaInfo = subNodeUtil.getNodeMetaInfo(n);

				// Currently the link will be an attachment URL, but need to research how ROME
				// handles attachments.
				if (metaInfo.getLink() == null) {
					metaInfo.setLink(metaInfo.getUrl());
				}
				SyndEntry entry = new SyndEntryImpl();

				entry.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "ID: " + n.getId().toHexString());
				entry.setLink(metaInfo.getLink() != null ? metaInfo.getLink() : "https://quanta.wiki");

				/*
				 * todo-1: need menu item "Set Create Time", and "Set Modify Time", that prompts
				 * with the datetime GUI, so publishers have more control over this in the feed,
				 * or else have an rssTimestamp as an optional property which can be set on any
				 * node to override this.
				 */
				entry.setPublishedDate(n.getCreateTime());
				SyndContent description = new SyndContentImpl();

				/*
				 * todo-1: NOTE: I tried putting some HTML into 'content' as a test and setting
				 * the mime type, but it doesn't render correctly, so I just need to research
				 * how to get HTML in RSS descriptions, but this is low priority for now so I'm
				 * not doing it yet
				 */
				description.setType("text/plain");
				// description.setType("text/html");
				description.setValue(metaInfo.getDescription() != null ? metaInfo.getDescription() : "");

				entry.setDescription(description);
				entries.add(entry);
			}
		}

		writeFeed(feed, writer);
	}

	private void writeFeed(SyndFeed feed, Writer writer) {
		if (writer != null) {
			SyndFeedOutput output = new SyndFeedOutput();
			String feedStr = null;
			try {
				feedStr = output.outputString(feed, false); // prettyPrint=false
				feedStr = convertStreamChars(feedStr);
				writer.write(feedStr);
			} catch (Exception e) {
				ExUtil.error(log, "multiRssFeed Error: ", e);
				throw new RuntimeException("internal server error");
			}
		}
	}

	/*
	 * Lots of feeds have characters that won't display nicely in HTML so we fix
	 * that here
	 */
	private String convertStreamChars(String s) {
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			if (c < 128) {
				sb.append(c);
			} else {
				switch (c) {
					case '—':
						sb.append("-");
						break;
					case '”':
						sb.append("\"");
						break;
					case '’':
						sb.append("'");
						break;
					default:
						sb.append(" ");
						break;
				}
			}
		}
		return sb.toString();
	}

	// DO NOT DELETE - this is the code to convert to HTML
	// private Stringn convertMarkdownToHtml() {
	// MutableDataSet options = new MutableDataSet();
	// options.set(Parser.EXTENSIONS, Arrays.asList(TablesExtension.create(),
	// TocExtension.create()));
	// options.set(TocExtension.LEVELS, TocOptions.getLevels(1, 2, 3, 4, 5, 6));

	// // This numbering works in the TOC but I haven't figured out how to number
	// the
	// // actual headings in the body of the document itself.
	// // options.set(TocExtension.IS_NUMBERED, true);

	// Parser parser = Parser.builder(options).build();
	// HtmlRenderer renderer = HtmlRenderer.builder(options).build();

	// recurseNode(exportNode, 0);

	// Node document = parser.parse(markdown.toString());
	// String body = renderer.render(document);
	// }
}
