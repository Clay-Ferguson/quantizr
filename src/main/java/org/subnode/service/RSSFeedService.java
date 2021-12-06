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
import com.rometools.modules.content.ContentModuleImpl;
import com.rometools.modules.itunes.EntryInformationImpl;
import com.rometools.modules.mediarss.MediaEntryModuleImpl;
import com.rometools.modules.mediarss.types.MediaContent;
import com.rometools.modules.mediarss.types.MediaGroup;
import com.rometools.modules.mediarss.types.Metadata;
import com.rometools.modules.mediarss.types.Thumbnail;
import com.rometools.rome.feed.module.DCModuleImpl;
import com.rometools.rome.feed.module.Module;
import com.rometools.rome.feed.synd.SyndContent;
import com.rometools.rome.feed.synd.SyndContentImpl;
import com.rometools.rome.feed.synd.SyndEnclosure;
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
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.subnode.AppServer;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.model.NodeMetaInfo;
import org.subnode.model.client.NodeProp;
import org.subnode.model.client.RssFeed;
import org.subnode.model.client.RssFeedEnclosure;
import org.subnode.model.client.RssFeedEntry;
import org.subnode.model.client.RssFeedMediaContent;
import org.subnode.mongo.MongoRepository;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.GetMultiRssRequest;
import org.subnode.response.GetMultiRssResponse;
import org.subnode.util.Const;
import org.subnode.util.DateUtil;
import org.subnode.util.ExUtil;
import org.subnode.util.LimitedInputStreamEx;
import org.subnode.util.StreamUtil;
import org.subnode.util.Util;
import org.subnode.util.XString;
import static org.subnode.util.Util.*;

/* Proof of Concept RSS Publishing */
@Component
public class RSSFeedService extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(RSSFeedService.class);

	private static boolean refreshingCache = false;

	private static final Object policyLock = new Object();
	PolicyFactory policy = null;

	private boolean USE_HTTP_READER = false;
	private boolean USE_URL_READER = false;
	private boolean USE_SPRING_READER = true;

	private static final RestTemplate restTemplate = new RestTemplate(Util.getClientHttpRequestFactory(10000));

	/*
	 * Cache of all feeds.
	 */
	private static final ConcurrentHashMap<String, SyndFeed> feedCache = new ConcurrentHashMap<>();

	private static final ConcurrentHashMap<Integer, String> feedNameOfItem = new ConcurrentHashMap<>();

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
	static boolean run = false;

	/*
	 * Runs immediately at startup, and then every 30 minutes, to refresh the feedCache.
	 */
	@Scheduled(fixedDelay = 30 * 60 * 1000)
	public void run() {
		if (run || !prop.isDaemonsEnabled() || !MongoRepository.fullInit)
			return;

		try {
			run = true;
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
		} finally {
			run = false;
		}
	}

	public void startupPreCache() {
		String rssNodeId = prop.getRssAggregatePreCacheNodeId();
		if (StringUtils.isEmpty(rssNodeId))
			return;

		arun.run(mongoSession -> {
			log.debug("startupPreCache: node=" + rssNodeId);
			multiRss(mongoSession, rssNodeId, null);
			return null;
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
					if (ok(feed)) {
						count++;
					} else {
						fails++;
					}
				}
			}

			for (String url : feedCache.keySet()) {
				// log.debug("Refreshing feed: " + url);
				SyndFeed feed = getFeed(url, false);
				if (ok(feed)) {
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
	public void multiRss(MongoSession ms, String nodeId, Writer writer) {
		SyndFeed feed = aggregateCache.get(nodeId);

		// if we didn't find in the cache built the feed
		if (no(feed)) {
			SubNode node = null;
			try {
				node = read.getNode(ms, nodeId);
				if (no(node)) {
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

			Iterable<SubNode> iter = read.getSubGraph(ms, node, null, 0, true);
			List<SubNode> children = read.iterateToList(iter);

			// Scan to collect all the urls.
			if (ok(children)) {
				int count = 0;
				for (SubNode n : children) {
					/* avoid infinite recursion here! */
					if (n.getIdStr().equals(nodeId))
						continue;

					String feedSrc = n.getStr(NodeProp.RSS_FEED_SRC.s());
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
		try {
			for (String url : urls) {
				// reset this to zero for each feed.
				int badDateCount = 0;

				SyndFeed inFeed = getFeed(url, true);
				if (ok(inFeed)) {
					for (SyndEntry entry : inFeed.getEntries()) {

						/*
						 * if no PublishedDate exists on the 'entry' itself try to get a reasonable data from some other
						 * sane property on the feed.
						 */
						if (no(entry.getPublishedDate())) {
							if (ok(entry.getUpdatedDate())) {
								entry.setPublishedDate(entry.getUpdatedDate());

							} else if (ok(inFeed.getPublishedDate())) {
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

						entries.add(entry);
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
				if (ok(inFeed)) {
					// log.debug("CACHE FEED HIT: " + XString.prettyPrint(inFeed));
					return inFeed;
				}
			}

			int timeout = 60; // seconds

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

			// log.debug("Feed " + url + " has " + inFeed.getEntries().size() + " entries.");
			// we update the cache regardless of 'fromCache' val. this is correct.
			feedCache.put(url, inFeed);

			// store knowledge of which feed Title goes with each entry instance.
			if (ok(inFeed.getEntries())) {
				for (SyndEntry se : inFeed.getEntries()) {
					feedNameOfItem.put(se.hashCode(), inFeed.getTitle());
				}
			}

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
			if (ok(reader)) {
				StreamUtil.close(reader);
			}
		}
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

		if (no(policy)) {
			synchronized (policyLock) {
				/*
				 * I have removed IMAGES only because it looks silly when we display an image that's also displayed
				 * as part of the feed formatting
				 */
				policy = Sanitizers.FORMATTING.and(Sanitizers.BLOCKS)/* .and(Sanitizers.IMAGES) */.and(Sanitizers.LINKS)//
						.and(Sanitizers.STYLES).and(Sanitizers.TABLES);
			}
		}
		html = policy.sanitize(html);
		if (html.length() > 1000) {
			html = html.substring(0, 1000) + "...";
		}
		return html;
	}

	public GetMultiRssResponse getMultiRssFeed(GetMultiRssRequest req) {
		GetMultiRssResponse res = new GetMultiRssResponse();
		List<String> urlList = XString.tokenize(req.getUrls(), "\n", true);
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
			aggregateFeeds(urlList, entries, req.getPage());
			// log.debug("Sending back " + entries.size() + " entries.");
		}
		/* If not an aggregate return the one external feed itself */
		else {
			String url = urlList.get(0);
			SyndFeed cachedFeed = getFeed(url, true);
			if (ok(cachedFeed)) {
				feed = new SyndFeedImpl();
				cloneFeedForPage(feed, cachedFeed, req.getPage());
			}
		}

		if (ok(feed)) {
			fixFeed(feed);
			boolean addFeedTitles = urlList.size() > 1;
			RssFeed rssFeed = convertToFeed(feed, addFeedTitles);
			// log.debug("FEED JSON: " + XString.prettyPrint(rssFeed));
			res.setFeed(rssFeed);
		}
		return res;
	}

	public RssFeed convertToFeed(SyndFeed feed, boolean addFeedTitles) {
		RssFeed rf = new RssFeed();
		// log.debug("convertToFeed: title=" + feed.getTitle());

		rf.setTitle(feed.getTitle());
		rf.setDescription(sanitizeHtml(feed.getDescription()));
		rf.setAuthor(feed.getAuthor());
		rf.setEncoding(feed.getEncoding());

		if (ok(feed.getImage())) {
			rf.setImage(feed.getImage().getUrl());
		}

		// I was trying to get the "image" for peter schiff's Feed (not items, but feed itself), and this
		// was my first attempt, and it didn't work. Not sure if his feed is bad or what. Will come back to
		// this later, RSS is good enough for now. todo-1.
		// processModules(feed, rf);

		rf.setLink(feed.getLink());

		List<RssFeedEntry> rssEntries = new LinkedList<>();
		rf.setEntries(rssEntries);

		if (ok(feed.getEntries())) {
			for (SyndEntry entry : feed.getEntries()) {
				// log.debug("Entry: " + XString.prettyPrint(entry));
				RssFeedEntry e = new RssFeedEntry();
				if (addFeedTitles) {
					e.setParentFeedTitle(feedNameOfItem.get(entry.hashCode()));
				}
				rssEntries.add(e);
				processEntry(entry, e);
			}
		}
		return rf;
	}

	private void processEntry(SyndEntry entry, RssFeedEntry e) {
		// log.debug("entry: " + entry.getTitle());

		if (ok(entry.getDescription())) {
			e.setDescription(sanitizeHtml(entry.getDescription().getValue()));
		}

		e.setTitle(entry.getTitle());
		e.setLink(entry.getLink());
		e.setPublishDate(DateUtil.shortFormatDate(entry.getPublishedDate().getTime()));
		e.setAuthor(entry.getAuthor());

		if (ok(entry.getContents())) {
			for (SyndContent content : entry.getContents()) {
				e.setDescription(sanitizeHtml(content.getValue()));
			}
		}

		// DO NOT DELETE
		// Don't know of use cases for this yet. Leaving as FYI.
		// List<Element> foreignMarkups = entry.getForeignMarkup();
		// for (Element foreignMarkup : foreignMarkups) {
		// String imgURL = foreignMarkup.getAttribute("url").getValue();
		// }

		if (ok(entry.getEnclosures())) {
			List<RssFeedEnclosure> enclosures = new LinkedList<>();
			e.setEnclosures(enclosures);

			for (SyndEnclosure enc : entry.getEnclosures()) {
				RssFeedEnclosure re = new RssFeedEnclosure();
				re.setType(enc.getType());
				re.setUrl(enc.getUrl());
				enclosures.add(re);
			}
		}

		processModules(entry, e);
	}

	private void processModules(SyndFeed entry, RssFeed e) {
		if (ok(entry.getModules())) {
			for (Module m : entry.getModules()) {

				// log.debug("Module: " + m.getClass().getName());
				if (m instanceof MediaEntryModuleImpl) {
					MediaEntryModuleImpl mm = (MediaEntryModuleImpl) m;
					if (ok(mm.getMediaContents())) {

						// put new list on return object
						List<RssFeedMediaContent> mediaContent = new LinkedList<>();

						// add mediaContent to RssFeed ?
						// e.setMediaContent(mediaContent);

						// process all media contents
						for (MediaContent mc : mm.getMediaContents()) {
							RssFeedMediaContent rfmc = new RssFeedMediaContent();
							rfmc.setType(mc.getType());
							rfmc.setUrl(mc.getReference().toString());
							rfmc.setMedium(mc.getMedium());
							mediaContent.add(rfmc);
						}
					}

					if (ok(mm.getMediaGroups())) {
						for (MediaGroup mg : mm.getMediaGroups()) {
							Metadata md = mg.getMetadata();
							if (ok(md)) {

								if (ok(md.getDescription())) {
									e.setDescription(sanitizeHtml(md.getDescription()));
								}
								if (ok(md.getEmbed())) {
									log.debug("Metadata Embed Url: " + md.getEmbed().getUrl());
								}

								if (ok(md.getThumbnail())) {
									for (Thumbnail tn : mg.getMetadata().getThumbnail()) {
										e.setImage(tn.getUrl().toASCIIString());
									}
								}
							} else {
								log.debug("MediaGroup has no metadata.");
							}
						}
					} else {
						log.debug("media has no groups.");
					}
				} else if (m instanceof ContentModuleImpl) {
					// ContentModuleImpl contentMod = (ContentModuleImpl) m;
					// if (ok(contentMod.getContents() )) {
					// for (String contents : contentMod.getContents()) {
					// log.debug("CI.contents: " + contents);
					// }
					// }
					// if (ok(contentMod.getContentItems() )) {
					// for (ContentItem ci : contentMod.getContentItems()) {
					// log.debug("CI.encoding: " + ci.getContentEncoding());
					// log.debug("CI.format: " + ci.getContentFormat());
					// log.debug("CI.value: " + ci.getContentValue());
					// log.debug("CI.url: " + ci.getContentResource());
					// }
					// }
				} else if (m instanceof EntryInformationImpl) {
					EntryInformationImpl itunesMod = (EntryInformationImpl) m;

					if (ok(itunesMod.getImage())) {
						try {
							e.setImage(itunesMod.getImage().toURI().toString());
						} catch (Exception e1) {
							// ignore
						}
					} else {
						e.setImage(itunesMod.getImageUri());
					}

					if (!StringUtils.isEmpty(itunesMod.getTitle())) {
						e.setTitle(itunesMod.getTitle());
					}
					// e.setSubTitle(itunesMod.getSubtitle());

					if (!StringUtils.isEmpty(itunesMod.getSummary())) {
						e.setDescription(sanitizeHtml(itunesMod.getSummary()));
					}
				}
				// what feeds use this? (todo-1)
				else if (m instanceof DCModuleImpl) {
					// DCModuleImpl dm = (DCModuleImpl) m;
					// String dcFormat = dm.getFormat();
					// String dcSource = dm.getSource();
					// String dcTitle = dm.getTitle();
					// log.debug("dcSource: " + dcSource);

				} else {
					log.debug("Unknown module type: " + m.getClass().getName());
				}
			}
		}
	}

	private void processModules(SyndEntry entry, RssFeedEntry e) {
		if (ok(entry.getModules())) {
			for (Module m : entry.getModules()) {

				// log.debug("Module: " + m.getClass().getName());
				if (m instanceof MediaEntryModuleImpl) {
					MediaEntryModuleImpl mm = (MediaEntryModuleImpl) m;
					if (ok(mm.getMediaContents())) {

						// put new list on return object
						List<RssFeedMediaContent> mediaContent = new LinkedList<>();
						e.setMediaContent(mediaContent);

						// process all media contents
						for (MediaContent mc : mm.getMediaContents()) {
							RssFeedMediaContent rfmc = new RssFeedMediaContent();
							rfmc.setType(mc.getType());
							rfmc.setUrl(mc.getReference().toString());
							rfmc.setMedium(mc.getMedium());
							mediaContent.add(rfmc);
						}
					}

					if (ok(mm.getMediaGroups())) {
						for (MediaGroup mg : mm.getMediaGroups()) {
							Metadata md = mg.getMetadata();
							if (ok(md)) {

								if (ok(md.getDescription())) {
									e.setDescription(sanitizeHtml(md.getDescription()));
								}
								if (ok(md.getEmbed())) {
									log.debug("Metadata Embed Url: " + md.getEmbed().getUrl());
								}

								if (ok(md.getThumbnail())) {
									for (Thumbnail tn : md.getThumbnail()) {
										e.setThumbnail(tn.getUrl().toASCIIString());
									}
								}
							} else {
								log.debug("MediaGroup has no metadata.");
							}
						}
					} else {
						log.debug("media has no groups.");
					}

					Metadata md = mm.getMetadata();
					if (ok(md)) {
						if (ok(md.getDescription())) {
							e.setDescription(sanitizeHtml(md.getDescription()));
						}

						if (ok(md.getThumbnail())) {
							for (Thumbnail tn : md.getThumbnail()) {
								e.setThumbnail(tn.getUrl().toASCIIString());
							}
						}
					}
				} else if (m instanceof ContentModuleImpl) {
					// ContentModuleImpl contentMod = (ContentModuleImpl) m;
					// if (ok(contentMod.getContents() )) {
					// for (String contents : contentMod.getContents()) {
					// log.debug("CI.contents: " + contents);
					// }
					// }
					// if (ok(contentMod.getContentItems() )) {
					// for (ContentItem ci : contentMod.getContentItems()) {
					// log.debug("CI.encoding: " + ci.getContentEncoding());
					// log.debug("CI.format: " + ci.getContentFormat());
					// log.debug("CI.value: " + ci.getContentValue());
					// log.debug("CI.url: " + ci.getContentResource());
					// }
					// }
				} else if (m instanceof EntryInformationImpl) {
					EntryInformationImpl itunesMod = (EntryInformationImpl) m;

					if (ok(itunesMod.getImage())) {
						try {
							e.setImage(itunesMod.getImage().toURI().toString());
						} catch (Exception e1) {
							// ignore
						}
					} else {
						e.setImage(itunesMod.getImageUri());
					}

					if (!StringUtils.isEmpty(itunesMod.getTitle())) {
						e.setTitle(itunesMod.getTitle());
					}
					e.setSubTitle(itunesMod.getSubtitle());

					if (!StringUtils.isEmpty(itunesMod.getSummary())) {
						e.setDescription(sanitizeHtml(itunesMod.getSummary()));
					}
				}
				// what feeds use this? (todo-1)
				else if (m instanceof DCModuleImpl) {
					// DCModuleImpl dm = (DCModuleImpl) m;
					// String dcFormat = dm.getFormat();
					// String dcSource = dm.getSource();
					// String dcTitle = dm.getTitle();
					// log.debug("dcSource: " + dcSource);

				} else {
					log.debug("Unknown module type: " + m.getClass().getName());
				}
			}
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
		feed.setImage(cachedFeed.getImage());

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

	public void getRssFeed(MongoSession ms, String nodeId, Writer writer) {
		SubNode node = read.getNode(ms, nodeId);

		SyndFeed feed = new SyndFeedImpl();
		feed.setEncoding("UTF-8");
		feed.setFeedType("rss_2.0");

		NodeMetaInfo metaInfo = snUtil.getNodeMetaInfo(node);
		feed.setTitle(ok(metaInfo.getTitle()) ? metaInfo.getTitle() : "");
		feed.setLink("");
		feed.setDescription(sanitizeHtml(ok(metaInfo.getDescription()) ? metaInfo.getDescription() : ""));

		List<SyndEntry> entries = new LinkedList<>();
		feed.setEntries(entries);

		Iterable<SubNode> iter = read.getChildren(ms, node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0);
		List<SubNode> children = read.iterateToList(iter);

		if (ok(children)) {
			for (SubNode n : children) {
				metaInfo = snUtil.getNodeMetaInfo(n);

				// Currently the link will be an attachment URL, but need to research how ROME
				// handles attachments.
				if (no(metaInfo.getAttachmentUrl())) {
					metaInfo.setAttachmentUrl(metaInfo.getUrl());
				}
				SyndEntry entry = new SyndEntryImpl();

				entry.setTitle(ok(metaInfo.getTitle()) ? metaInfo.getTitle() : "ID: " + n.getIdStr());
				entry.setLink(ok(metaInfo.getAttachmentUrl()) ? metaInfo.getAttachmentUrl() : prop.getProtocolHostAndPort());

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
				description.setType("text/html");
				description.setValue(sanitizeHtml(ok(metaInfo.getDescription()) ? metaInfo.getDescription() : ""));
				entry.setDescription(description);

				entries.add(entry);
			}
		}

		writeFeed(feed, writer);
	}

	private void fixFeed(SyndFeed feed) {
		if (no(feed))
			return;
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
		if (ok(writer) && ok(feed)) {
			try {
				fixFeed(feed);
				SyndFeedOutput output = new SyndFeedOutput();
				boolean prettyPrint = true;
				String feedStr = output.outputString(feed, prettyPrint);
				feedStr = convertStreamChars(feedStr);
				// log.debug("FEED XML: " + feedStr);
				writer.write(feedStr);
			} catch (Exception e) {
				ExUtil.error(log, "writeFeed Error: ", e);
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
