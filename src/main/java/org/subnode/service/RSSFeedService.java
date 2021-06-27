package org.subnode.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.io.Writer;
import java.net.URL;
import java.net.URLConnection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import com.rometools.rome.feed.synd.SyndContent;
import com.rometools.rome.feed.synd.SyndContentImpl;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndEntryImpl;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.feed.synd.SyndFeedImpl;
import com.rometools.rome.io.FeedException;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.SyndFeedOutput;
import com.rometools.rome.io.XmlReader;
import org.apache.commons.io.IOUtils;
import org.apache.commons.io.input.CharSequenceReader;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.subnode.AppServer;
import org.subnode.config.AppProp;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.model.NodeMetaInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.RunAsMongoAdmin;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.Const;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.StreamUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.Util;
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

	private static final Object policyLock = new Object();
	PolicyFactory policy = null;

	private boolean USE_HTTP_READER = false;
	private boolean USE_URL_READER = false;
	private boolean USE_SPRING_READER = true;

	private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory());

	/*
	 * Cache of all feeds.
	 */
	private static final ConcurrentHashMap<String, SyndFeed> feedCache = new ConcurrentHashMap<>();

	/*
	 * keep track of which feeds failed so we don't try them again until another 30-min cycle
	 */
	private static final HashSet<String> failedFeeds = new HashSet<>();

	/*
	 * Cache of all aggregates
	 */
	private static final ConcurrentHashMap<String, SyndFeed> aggregateCache = new ConcurrentHashMap<>();

	private static int MAX_CACHE_SIZE = 500;
	public static final LinkedHashMap<String, byte[]> proxyCache =
			new LinkedHashMap<String, byte[]>(MAX_CACHE_SIZE + 1, .75F, false) {
				protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
					return size() > MAX_CACHE_SIZE;
				}
			};


	private static int runCount = 0;

	// NOTE: Same value appears in RSSTypeHandler.ts
	private static final int MAX_FEED_ITEMS = 50;

	private static final int MAX_FEEDS_PER_AGGREGATE = 40;

	static Object runLock = new Object();

	/*
	 * Runs immediately at startup, and then every 30 minutes, to refresh the feedCache.
	 */
	@Scheduled(fixedDelay = 30 * 60 * 1000)
	public void run() {
		synchronized (runLock) {
			runCount++;
			if (runCount == 1) {
				startupPreCache();
			}

			if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
				log.debug("ignoring RSSFeedService schedule cycle");
				return;
			}

			log.debug("RSSFeedService.refreshFeedCache");
			refreshFeedCache();
			aggregateCache.clear();
			proxyCache.clear();
		}
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
			int count = 0, fails = 0;

			if (failedFeeds.size() > 0) {
				List<String> failedFeedsList = new LinkedList<>(failedFeeds);
				failedFeeds.clear();

				for (String url : failedFeedsList) {
					log.debug("Retrying previously failed feed: " + url);
					SyndFeed feed = getFeed(url, false);
					if (feed != null) {
						count++;
					} else {
						fails++;
					}
				}
			}

			for (String url : feedCache.keySet()) {
				// log.debug("Refreshing feed: " + url);
				SyndFeed feed = getFeed(url, false);
				if (feed != null) {
					count++;
				} else {
					fails++;
				}
			}
			return "Refreshed " + String.valueOf(count) + " feeds. (Fail Count: " + String.valueOf(fails) + ")";
		} finally {
			refreshingCache = false;
		}
	}

	/*
	 * Streams back an RSS feed that is an aggregate feed of all the children under nodeId
	 * (recursively!) that have an RSS_FEED_SRC property
	 * 
	 * If writer is null it means we are just running without writing to a server like only to prewarm
	 * the cache during app startup called from startupPreCache
	 * 
	 * NOTE: pagination isn't supported yet in this. See "1" arg below, which means first page
	 */
	public void multiRss(MongoSession mongoSession, final String nodeId, Writer writer) {
		SyndFeed feed = aggregateCache.get(nodeId);

		// if we didn't find in the cache built the feed
		if (feed == null) {
			SubNode node = null;
			try {
				node = read.getNode(mongoSession, nodeId);
				if (node == null) {
					return;
				}
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

			List<SyndEntry> entries = new LinkedList<>();
			feed.setEntries(entries);
			List<String> urls = new LinkedList<>();

			final Iterable<SubNode> iter = read.getSubGraph(mongoSession, node, null, 0);
			final List<SubNode> children = read.iterateToList(iter);

			// Scan to collect all the urls.
			if (children != null) {
				int count = 0;
				for (final SubNode n : children) {
					/* avoid infinite recursion here! */
					if (n.getId().toHexString().equals(nodeId))
						continue;

					String feedSrc = n.getStrProp(NodeProp.RSS_FEED_SRC.s());
					if (!StringUtils.isEmpty(feedSrc) && !feedSrc.contains(nodeId)) {
						urls.add(feedSrc);
						if (++count >= MAX_FEEDS_PER_AGGREGATE) {
							break;
						}
					}
				}
			}

			aggregateFeeds(urls, entries, 1);
			aggregateCache.put(nodeId, feed);
		}

		writeFeed(feed, writer);
	}

	public void aggregateFeeds(List<String> urls, List<SyndEntry> entries, int page) {
		log.debug("Generating aggregateFeed.");
		try {
			for (String url : urls) {

				// reset this to zero for each feed.
				int badDateCount = 0;

				SyndFeed inFeed = getFeed(url, true);
				if (inFeed != null) {
					for (SyndEntry entry : inFeed.getEntries()) {

						/*
						 * if no PublishedDate exists on the 'entry' itself try to get a reasonable data from some other
						 * sane property on the feed.
						 */
						if (entry.getPublishedDate() == null) {
							if (entry.getUpdatedDate() != null) {
								entry.setPublishedDate(entry.getUpdatedDate());

							} else if (inFeed.getPublishedDate() != null) {
								/*
								 * If we have to take the feed update time from the feed itself because of lack of dates in feed
								 * entries the only allow a max of 3 of these to exist so that no malformed feeds can flood the
								 * top of our GUI presentation with more than 3 items
								 */
								if (badDateCount < 3) {
									entry.setPublishedDate(inFeed.getPublishedDate());
									badDateCount++;
								}
							}
						}

						if (entry.getPublishedDate() != null) {
							SyndEntry entryClone = (SyndEntry) entry.clone();
							/*
							 * We use this slight hack/technique to allow our client to be able to parse the titles out of the
							 * feeds for displaying them in a nicer way, while being unobtrusive enough that any podcast app
							 * could display it and it looks fine as it also.
							 */
							entryClone.setTitle(inFeed.getTitle() + " :: " + entryClone.getTitle());
							entries.add(entryClone);
						}
					}
				}
			}
			entries.sort((s1, s2) -> s2.getPublishedDate().compareTo(s1.getPublishedDate()));

			/*
			 * Now from the complete 'entries' list we extract out just the page we need into 'pageEntires' and
			 * then stuff pageEntries back into 'entries' to send out of this method
			 */
			List<SyndEntry> pageEntries = new LinkedList<>();
			int pageNo = page - 1;
			int startIdx = pageNo * MAX_FEED_ITEMS;
			int idx = 0;
			for (SyndEntry entry : entries) {
				if (idx >= startIdx) {
					pageEntries.add(entry);
					if (pageEntries.size() >= MAX_FEED_ITEMS) {
						break;
					}
				}
				idx++;
			}
			entries.clear();
			entries.addAll(pageEntries);
		} catch (Exception e) {
			ExUtil.error(log, "Error: ", e);
		}
	}

	public SyndFeed getFeed(String url, boolean fromCache) {
		// log.debug("getFeed: " + url);

		/*
		 * if this feed failed don't try it again. Whenever we DO force the system to try a feed again
		 * that's done by wiping failedFeeds clean but this 'getFeed' method should just bail out if the
		 * feed has failed
		 */
		if (fromCache && failedFeeds.contains(url)) {
			return null;
		}

		Reader reader = null;
		try {
			SyndFeed inFeed = null;

			if (fromCache) {
				inFeed = feedCache.get(url);
				if (inFeed != null) {
					// log.debug("FEED: " + XString.prettyPrint(inFeed));
					return inFeed;
				}
			}

			int timeout = 60; // seconds
			// log.debug("Reading RSS stream");

			if (USE_URL_READER) {
				/*
				 * This is not a memory leak that we don't close the connection. This is correct. No need to close
				 */
				URLConnection conn = new URL(url).openConnection();

				conn.setConnectTimeout(timeout * 1000);
				conn.setReadTimeout(timeout * 1000);
				reader = new XmlReader(conn);

				SyndFeedInput input = new SyndFeedInput();
				inFeed = input.build(reader);
			}

			/*
			 * I was experimenting this this way of getting a reader as a last attempt to get a specific
			 * problematic URL to work, that keeps causing a timeout when I try to read from it thru the server
			 * side, even though the same url works fine when entered into my browser url, so one trick that has
			 * worked in the past was to masquerade as a browser using the 'user agent'. So this code DOES work,
			 * but never did solve the problem with that one specific URL that simply refuses to send data to
			 * the Quanta server.
			 * 
			 * UPDATE: I'm leaving the long explanation above, but once I tried the code inside
			 * USE_SPRING_READER=true, block suddenly all the RSS feeds no longer have any timeout issues. My
			 * best theory for why is that my restTemplate is doing something special that fixes these issues.
			 */
			if (USE_HTTP_READER) {
				RequestConfig config = RequestConfig.custom() //
						.setConnectTimeout(timeout * 1000) //
						.setConnectionRequestTimeout(timeout * 1000) //
						.setSocketTimeout(timeout * 1000).build();

				HttpClient client = HttpClientBuilder.create().setDefaultRequestConfig(config).build();
				HttpGet request = new HttpGet(url);

				request.addHeader("User-Agent", Const.FAKE_USER_AGENT);
				HttpResponse response = client.execute(request);
				InputStream is = response.getEntity().getContent();
				LimitedInputStreamEx limitedIs = new LimitedInputStreamEx(is, 100 * Const.ONE_MB);

				byte[] buffer = IOUtils.toByteArray(limitedIs);
				reader = new CharSequenceReader(new String(buffer));

				SyndFeedInput input = new SyndFeedInput();
				inFeed = input.build(reader);
			}

			if (USE_SPRING_READER) {
				inFeed = restTemplate.execute(url, HttpMethod.GET, null, response -> {
					SyndFeedInput input = new SyndFeedInput();
					try {
						return input.build(new XmlReader(new LimitedInputStreamEx(response.getBody(), 100 * Const.ONE_MB)));
					} catch (FeedException e) {
						throw new IOException("Could not parse response", e);
					}
				});
			}

			// another example from online (that I've never tried):
			// try (CloseableHttpClient client = HttpClients.createMinimal()) {
			// HttpUriRequest request = new HttpGet(url);
			// try (CloseableHttpResponse response = client.execute(request);
			// InputStream stream = response.getEntity().getContent()) {
			// SyndFeedInput input = new SyndFeedInput();
			// SyndFeed feed = input.build(new XmlReader(stream));
			// System.out.println(feed.getTitle());
			// }
			// }

			// log.debug("Feed " + url + " has " + inFeed.getEntries().size() + "
			// entries.");
			sanitizeFeed(inFeed);

			// we update the cache regardless of 'fromCache' val. this is correct.
			feedCache.put(url, inFeed);
			return inFeed;
		} catch (Exception e) {
			/*
			 * Leave feedCache with any existing mapping it has when it fails. Worst case here is a stale cache
			 * remains in place rather than getting forgotten just because it's currently unavailable
			 *
			 * This error can happen a lot since feeds out on the wild are so chaotic so we won't bother to
			 * clutter our logs with a stack trace here, and just log the message.
			 * 
			 * todo-1: Actually it would be better to put this entire string being logged here into a hashset to
			 * just keep a unique list, and not even log it here, but make it part of the 'systemInfo' available
			 * under the admin menu for checking server status info.
			 */
			log.debug("Error reading feed: " + url + " -> " + e.getMessage());
			failedFeeds.add(url);
			return null;
		} finally {
			if (reader != null) {
				StreamUtil.close(reader);
			}
		}
	}

	public void sanitizeFeed(SyndFeed feed) {
		feed.setDescription(sanitizeHtml(feed.getDescription()));
		for (SyndEntry entry : feed.getEntries()) {

			// sanitize entry.title
			if (entry.getTitle() != null) {
				entry.setTitle(quoteFix(entry.getTitle()));
			}

			// sanitize entry.description.value
			if (entry.getDescription() != null && entry.getDescription().getValue() != null) {
				entry.getDescription().setValue(quoteFix(entry.getDescription().getValue()));
			}

			for (SyndContent content : entry.getContents()) {
				if (content.getValue() != null) {
					content.setValue(sanitizeHtml(content.getValue()));
				}
			}
		}
		// log.debug("SyndFeed: " + XString.prettyPrint(feed));
	}

	private String quoteFix(String html) {
		html = html.replace("&#8221;", "'");
		html = html.replace("&#8220;", "'");

		// Warning these ARE two different characters, even though they look the same.
		html = html.replace("’", "'");
		html = html.replace("‘", "'");

		// special kinds of dashes
		html = html.replace("–", "--");
		return html;
	}

	// See also: https://github.com/OWASP/java-html-sanitizer
	private String sanitizeHtml(String html) {
		if (StringUtils.isEmpty(html))
			return html;

		// this sanitizer seems to choke on these special quotes so replace them first.
		html = quoteFix(html);

		if (policy == null) {
			synchronized (policyLock) {
				policy = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.IMAGES).and(Sanitizers.LINKS)//
						.and(Sanitizers.STYLES).and(Sanitizers.TABLES);
			}
		}
		return policy.sanitize(html);
	}

	/*
	 * Takes a newline delimited list of rss feed urls, and returns the feed for them as an aggregate
	 * while also updating our caching
	 * 
	 * Page will be 1 offset (1, 2, 3, ...)
	 */
	public void multiRssFeed(String urls, Writer writer, int page) {

		List<String> urlList = XString.tokenize(urls, "\n", true);
		urlList.removeIf(url -> url.startsWith("#") || StringUtils.isEmpty(url.trim()));

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
			List<SyndEntry> entries = new LinkedList<>();
			feed.setEntries(entries);
			aggregateFeeds(urlList, entries, page);
			// log.debug("Sending back " + entries.size() + " entries.");
			writeFeed(feed, writer);
		}
		/* If not an aggregate return the one external feed itself */
		else {
			String url = urlList.get(0);
			SyndFeed cachedFeed = getFeed(url, true);
			if (cachedFeed != null) {
				feed = new SyndFeedImpl();
				cloneFeedForPage(feed, cachedFeed, page);
			}
		}

		if (feed != null) {
			writeFeed(feed, writer);
		}
	}

	/*
	 * Makes feed be a cloned copy of cachedFeed but with only the specific 'page' of results extracted
	 */
	private void cloneFeedForPage(SyndFeed feed, SyndFeed cachedFeed, int page) {

		feed.setEncoding(cachedFeed.getEncoding());
		feed.setFeedType(cachedFeed.getFeedType());
		feed.setTitle(cachedFeed.getTitle());
		feed.setDescription(cachedFeed.getDescription());
		feed.setAuthor(cachedFeed.getAuthor());
		feed.setLink(cachedFeed.getLink());

		List<SyndEntry> entries = new LinkedList<>();
		feed.setEntries(entries);

		// make page zero-offset before using.
		int pageNo = page - 1;
		int startIdx = pageNo * MAX_FEED_ITEMS;
		int idx = 0;
		for (SyndEntry entry : cachedFeed.getEntries()) {
			if (idx >= startIdx) {
				entries.add(entry);
				if (entries.size() >= MAX_FEED_ITEMS) {
					break;
				}
			}
			idx++;
		}
	}

	public void getRssFeed(MongoSession mongoSession, String nodeId, Writer writer) {
		SubNode node = read.getNode(mongoSession, nodeId);

		SyndFeed feed = new SyndFeedImpl();
		feed.setEncoding("UTF-8");
		feed.setFeedType("rss_2.0");

		NodeMetaInfo metaInfo = subNodeUtil.getNodeMetaInfo(node);
		feed.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "");
		feed.setLink("");
		feed.setDescription(metaInfo.getDescription() != null ? metaInfo.getDescription() : "");

		List<SyndEntry> entries = new LinkedList<SyndEntry>();
		feed.setEntries(entries);

		final Iterable<SubNode> iter =
				read.getChildren(mongoSession, node, Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		if (children != null) {
			for (final SubNode n : children) {
				metaInfo = subNodeUtil.getNodeMetaInfo(n);

				// Currently the link will be an attachment URL, but need to research how ROME
				// handles attachments.
				if (metaInfo.getAttachmentUrl() == null) {
					metaInfo.setAttachmentUrl(metaInfo.getUrl());
				}
				SyndEntry entry = new SyndEntryImpl();

				entry.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "ID: " + n.getId().toHexString());
				entry.setLink(
						metaInfo.getAttachmentUrl() != null ? metaInfo.getAttachmentUrl() : appProp.getProtocolHostAndPort());

				/*
				 * todo-2: need menu item "Set Create Time", and "Set Modify Time", that prompts with the datetime
				 * GUI, so publishers have more control over this in the feed, or else have an rssTimestamp as an
				 * optional property which can be set on any node to override this.
				 * 
				 * UPDATE: Now that we have 'date' property as a generic feature of nodes (calendar icon on edit
				 * dialog) we can use that as our publish time here, and allow that to be the override for the date
				 * on the node.
				 */
				entry.setPublishedDate(n.getCreateTime());
				SyndContent description = new SyndContentImpl();

				/*
				 * todo-1: NOTE: I tried putting some HTML into 'content' as a test and setting the mime type, but
				 * it doesn't render correctly, so I just need to research how to get HTML in RSS descriptions, but
				 * this is low priority for now so I'm not doing it yet.
				 * 
				 * todo-1: NOTE: when org.owasp.html.Sanitizers capability was added, I forgot to revisit this, so I
				 * need to check what I'm doing here and see if we need "HTML" now here instead.
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

	private void fixFeed(SyndFeed feed) {
		if (StringUtils.isEmpty(feed.getEncoding()))
			feed.setEncoding("UTF-8");
		if (StringUtils.isEmpty(feed.getFeedType()))
			feed.setFeedType("rss_2.0");
		if (StringUtils.isEmpty(feed.getTitle()))
			feed.setTitle("");
		if (StringUtils.isEmpty(feed.getDescription()))
			feed.setDescription("");
		if (StringUtils.isEmpty(feed.getAuthor()))
			feed.setAuthor("");
		if (StringUtils.isEmpty(feed.getLink()))
			feed.setLink("");
	}

	private void writeFeed(SyndFeed feed, Writer writer) {
		if (writer != null) {
			try {
				fixFeed(feed);
				SyndFeedOutput output = new SyndFeedOutput();
				boolean prettyPrint = true;
				String feedStr = output.outputString(feed, prettyPrint);
				feedStr = convertStreamChars(feedStr);
				// log.debug("FEED XML: " + feedStr);
				writer.write(feedStr);
			} catch (Exception e) {
				ExUtil.error(log, "multiRssFeed Error: ", e);
				throw new RuntimeException("internal server error");
			}
		}
	}

	/*
	 * Lots of feeds have characters that won't display nicely in HTML so we fix that here
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
