package quanta.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.commons.lang3.StringUtils;
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
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
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.SyndFeedOutput;
import com.rometools.rome.io.XmlReader;
import quanta.AppServer;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.model.NodeMetaInfo;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.model.client.PrincipalName;
import quanta.model.client.RssFeed;
import quanta.model.client.RssFeedEnclosure;
import quanta.model.client.RssFeedEntry;
import quanta.model.client.RssFeedMediaContent;
import quanta.mongo.MongoRepository;
import quanta.mongo.model.SubNode;
import quanta.rest.request.GetMultiRssRequest;
import quanta.rest.response.GetMultiRssResponse;
import quanta.rest.response.PushPageMessage;
import quanta.util.Const;
import quanta.util.DateUtil;
import quanta.util.ExUtil;
import quanta.util.LimitedInputStreamEx;
import quanta.util.StreamUtil;
import quanta.util.TL;
import quanta.util.Util;
import quanta.util.XString;
import quanta.util.val.Val;
import reactor.core.publisher.Mono;

/* Proof of Concept RSS Publishing */
@Component
public class RSSFeedService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(RSSFeedService.class);
    private static boolean refreshingCache = false;
    private static final Object policyLock = new Object();
    PolicyFactory policy = null;
    // Cache of all feeds.
    private static final ConcurrentHashMap<String, SyndFeed> feedCache = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, String> feedNameOfItem = new ConcurrentHashMap<>();
    // keep track of which feeds failed so we don't try them again until another 30-min cycle
    private static final HashSet<String> failedFeeds = new HashSet<>();
    private static final HashSet<String> redirects = new HashSet<>();

    // Cache of all aggregates
    private static final ConcurrentHashMap<String, SyndFeed> aggregateCache = new ConcurrentHashMap<>();
    private static int MAX_CACHE_SIZE = 500;
    private static final boolean debug = true;

    public static final LinkedHashMap<String, byte[]> proxyCache =
            new LinkedHashMap<String, byte[]>(MAX_CACHE_SIZE + 1, 0.75F, false) {
                protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
                    return size() > MAX_CACHE_SIZE;
                }
            };
    private static final int FEED_ITEMS_PER_PAGE = 75;
    private static final int REFRESH_FREQUENCY_MINS = 480; // 8 hrs
    private static Object cacheLock = new Object();

    /*
     * Runs immediately at startup, and then every few minutes, to refresh the feedCache.
     */
    @Scheduled(fixedDelay = REFRESH_FREQUENCY_MINS * 60 * 1000)
    public void run() {
        if (!initComplete || !svc_prop.isDaemonsEnabled() || !MongoRepository.fullInit)
            return;

        svc_arun.run(() -> {
            synchronized (cacheLock) {
                if (AppServer.isShuttingDown() || !AppServer.isEnableScheduling()) {
                    log.debug("ignoring RSSFeedService schedule cycle");
                    return null;
                }
                log.debug("RSSFeedService.refreshFeedCache");
                refreshFeedCache();
                aggregateCache.clear();
                proxyCache.clear();
            }
            return null;
        });
    }

    public String getFeedStatus() {
        String ret = "";
        if (failedFeeds.size() > 0) {
            ret += "\nFailed Feeds:\n";
            for (String url : failedFeeds) {
                ret += "    " + url + "\n";
            }
        }

        if (redirects.size() > 0) {
            ret += "\nRedirected Feeds:\n";
            for (String urls : redirects) {
                ret += "    " + urls + "\n";
            }
        }
        if (ret.length() == 0) {
            ret = "No feed issues.";
        }
        return ret;
    }

    public String refreshFeedCache() {
        if (refreshingCache) {
            return "Cache refresh was already in progress.";
        }
        try {
            refreshingCache = true;
            int count = 0;
            int fails = 0;

            // Reload all feeds that were perviously FAILED
            if (failedFeeds.size() > 0) {
                List<String> failedFeedsList = new LinkedList<>(failedFeeds);
                failedFeeds.clear();

                for (String url : failedFeedsList) {
                    log.debug("Retrying previously failed feed: " + url);
                    SyndFeed feed = getFeed(url, false, 0, 0);
                    if (feed != null) {
                        count++;
                    } else {
                        fails++;
                    }
                }
            }

            // Reload all feeds that were perviously Successful
            for (String url : feedCache.keySet()) {
                log.debug("Refreshing feed: " + url);
                SyndFeed feed = getFeed(url, false, 0, 0);
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

    public void aggregateFeeds(List<String> urls, List<SyndEntry> entries, int page) {
        try {
            // Reads all the feeds from the web and creates 'entries' for all content.
            int index = 0;
            for (String url : urls) {
                SyndFeed inFeed = getFeed(url, true, ++index, urls.size());
                if (inFeed != null) {
                    for (SyndEntry entry : inFeed.getEntries()) {
                        if (entry.getPublishedDate() != null) {
                            entries.add(entry);
                        }
                    }
                }
            }

            entries.sort((s1, s2) -> s2.getPublishedDate().compareTo(s1.getPublishedDate()));
            // Now from the complete 'entries' list we extract out just the page we need into 'pageEntires'
            // and then stuff pageEntries back into 'entries' to send out of this method
            List<SyndEntry> pageEntries = new LinkedList<>();
            int pageNo = page - 1;
            int startIdx = pageNo * FEED_ITEMS_PER_PAGE;
            int idx = 0;

            for (SyndEntry entry : entries) {
                if (idx >= startIdx) {
                    pageEntries.add(entry);
                    if (pageEntries.size() >= FEED_ITEMS_PER_PAGE) {
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

    public void preCacheAdminFeeds() {
        synchronized (cacheLock) {
            log.debug("preCacheAdminFeeds()");
            SubNode rootNode = svc_mongoRead.getNode("/r");
            if (rootNode == null) {
                log.debug("No accountRoot found, so no feeds to cache.");
                return;
            }

            // we use a set so there's no duplicates
            HashSet<String> urlSet = new HashSet<>();
            Iterable<SubNode> nodes =
                    svc_mongoRead.findSubNodesByType(rootNode, NodeType.RSS_FEED.s(), true, null, null);
            for (SubNode node : nodes) {
                // this try block is so that if one feed fails it doesn't stop the whole process
                try {
                    if (!svc_acl.isAdminOwned(node)) {
                        continue;
                    }

                    // get RSS_FEED_SRC property
                    String urls = node.getStr(NodeProp.RSS_FEED_SRC);
                    if (urls == null) {
                        continue;
                    }

                    // split url by newline
                    List<String> urlList = XString.tokenize(urls, "\n", true);
                    if (urlList == null || urlList.size() == 0) {
                        continue;
                    }

                    // iterate through each url and cache it
                    for (String url : urlList) {
                        if (url.startsWith("#") || StringUtils.isEmpty(url.trim())) {
                            continue;
                        }
                        urlSet.add(url);
                    }
                } catch (Exception e) {
                    ExUtil.error(log, "Error: ", e);
                }
            }

            // cache all the feeds
            for (String url : urlSet) {
                log.debug("Caching feed: " + url);
                getFeed(url, false, 0, 0);
            }
        }
    }

    public SyndFeed getFeed(String url, boolean fromCache, int index, int maxIndex) {
        String originalUrl = url;

        // if this feed failed don't try it again. Whenever we DO force the system to try a feed again
        // that's done by wiping failedFeeds clean but this 'getFeed' method should just bail out if the
        // feed has failed
        if (fromCache && failedFeeds.contains(url)) {
            if (debug) {
                log.debug("Feed previously failed (skipping): " + url);
            }
            // if the feed has failed at least attempt to get from the cache whatever the latest is that we have
            return feedCache.get(url);
        }

        Reader reader = null;
        try {
            SyndFeed inFeed = null;
            if (fromCache) {
                inFeed = feedCache.get(url);
                if (inFeed != null) {
                    if (debug) {
                        log.debug("Got Feed from Cache: " + url);
                    }
                    return inFeed;
                }
            }
            if (debug) {
                log.debug("Reading Feed from Web: " + url);
            }

            if (TL.getSC() != null) {
                try {
                    String msg = "Reading (" + index + " / " + maxIndex + ") " + url;
                    PushPageMessage pushPageMessage = new PushPageMessage(msg, false, "rssProgressText");
                    svc_push.pushInfo(TL.getSC(), pushPageMessage);
                } catch (Exception e) {
                    log.debug("Error pushing rssProgressText: " + e.getMessage());
                }
            }

            long start = System.currentTimeMillis();
            String response = null;
            int tries = 0;

            // we try two times, which is onece for the original call and once more of it's a redirect
            while (++tries < 3) {
                Val<String> redirectUrl = new Val<>();
                String _url = url;
                WebClient webClient = Util.webClientBuilder().exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(100 * 1024 * 1024)).build())
                        // NOTE: These two 'filter' calls are what is required to detect redirects.
                        .filter(ExchangeFilterFunction.ofRequestProcessor(clientRequest -> {
                            // log.debug("Request URL: " + clientRequest.url());
                            return Mono.just(clientRequest);
                        })).filter(ExchangeFilterFunction.ofResponseProcessor(clientResponse -> {
                            clientResponse.headers().asHttpHeaders()
                                    .forEach((name, values) -> values.forEach(value -> log.debug(name + "=" + value)));
                            if (clientResponse.statusCode().is3xxRedirection()) {
                                redirectUrl.setVal(clientResponse.headers().header("Location").get(0));
                                redirects.add(_url + " --> " + redirectUrl.getVal());
                                // log.debug("Redirected to: " + redirectUrl);
                            }
                            return Mono.just(clientResponse);
                        })).build();

                try {
                    response = webClient.get().uri(url)//
                            .retrieve() //
                            .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                                    clientResponse -> {
                                        // This will trigger for any response with 4xx or 5xx status codes
                                        return clientResponse.bodyToMono(String.class).flatMap(errorBody -> {
                                            log.debug("Error response from server: " + errorBody);
                                            return Mono.error(
                                                    new RuntimeException("Error response from server: " + errorBody));
                                        });
                                    })//
                            .bodyToMono(String.class)//
                            .timeout(Duration.ofSeconds(60))//
                            .block();
                } catch (WebClientResponseException e) {
                    // This exception is thrown for HTTP status code errors
                    throw new RuntimeEx("Error while calling the RSS feed service: " + e.getMessage() + " Status Code: "
                            + e.getStatusCode(), e);
                } catch (WebClientRequestException e) {
                    // This exception is thrown for errors while making the request (e.g., connectivity issues)
                    throw new RuntimeEx("Request error while calling the RSS feed service: " + e.getMessage(), e);
                } catch (Exception e) {
                    /*
                     * Note: A common failure scenario here happens when servers opt to return HTML that does a redirect
                     * in an apparent attempt to stop RSS readers from being able to use the feed, and instead expect
                     * their browsers to be used. This is a common tactic used by sites that want to track users, or
                     * force them to view ads, or simply stop their RSS feeds from being used by other sites.
                     * 
                     * First known example of this tactic for me was: https://defence-blog.com/feed
                     */
                    // This is a generic exception handler for other exceptions
                    throw new RuntimeEx("General error while calling the RSS feed service: " + e.getMessage(), e);
                }

                if (redirectUrl.hasVal()) {
                    url = redirectUrl.getVal();
                    log.debug("Redirecting to: " + url + " len of redirect response: " + response.length());
                } else {
                    break;
                }
            }

            if (response == null) {
                throw new RuntimeEx("Could not read feed: " + url);
            }
            // log.debug("RSS Response: " + response);

            InputStream inputStream = new LimitedInputStreamEx(
                    new ByteArrayInputStream(response.getBytes(StandardCharsets.UTF_8)), 100 * Const.ONE_MB);
            try {
                SyndFeedInput input = new SyndFeedInput();
                XmlReader xmlReader = new XmlReader(inputStream, true);
                inFeed = input.build(xmlReader);
            } catch (Exception e) {
                throw new RuntimeEx("Could not parse response for feed: " + url, e);
            }

            long time = System.currentTimeMillis() - start;
            if (time > 3000) {
                log.debug("Feed Read Time: " + DateUtil.formatDurationMillis(time, true) + " url=" + url);
            }

            // we update the cache regardless of 'fromCache' val. this is correct.
            feedCache.put(url, inFeed);

            // if we did a redirect we can make sure the original url is also cached
            if (!originalUrl.equals(url)) {
                feedCache.put(originalUrl, inFeed);
            }

            // store knowledge of which feed Title goes with each entry instance.
            if (inFeed != null && inFeed.getEntries() != null) {
                log.debug("Feed items: " + inFeed.getEntries().size());
                for (SyndEntry se : inFeed.getEntries()) {
                    feedNameOfItem.put(se.getUri(), inFeed.getTitle());
                }
            } else {
                if (debug) {
                    log.debug("Feed was empty! " + url);
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
             */
            // under the admin menu for checking server status info.
            log.debug("Error reading feed: " + url + " msg: " + e.getMessage());
            failedFeeds.add(url);
            // if the feed has failed at least attempt to get from the cache whatever the latest is that we have
            return feedCache.get(url);
        } finally {
            if (reader != null) {
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
        if (policy == null) {
            synchronized (policyLock) {
                /*
                 * I have removed IMAGES only because it looks silly when we display an image that's also displayed
                 * as part of the feed formatting
                 */
                policy = /* .and(Sanitizers.IMAGES) *///
                        Sanitizers.FORMATTING.and(Sanitizers.BLOCKS).and(Sanitizers.LINKS).and(Sanitizers.STYLES)
                                .and(Sanitizers.TABLES);
            }
        }
        html = policy.sanitize(html);
        if (html.length() > 1000) {
            html = html.substring(0, 1000) + "...";
        }
        return html;
    }

    public GetMultiRssResponse cm_getMultiRssFeed(GetMultiRssRequest req) {
        GetMultiRssResponse res = new GetMultiRssResponse();

        // parse out list of URLs, and remove commented lines
        List<String> urlList = XString.tokenize(req.getUrls(), "\n", true);
        urlList.removeIf(url -> url.startsWith("#") || StringUtils.isEmpty(url.trim()));
        SyndFeed feed = null;

        // If multiple feeds we build an aggregate
        if (urlList.size() > 1) {
            feed = new SyndFeedImpl();
            feed.setEncoding("UTF-8");
            feed.setFeedType("rss_2.0");
            feed.setTitle("");
            feed.setDescription("");
            feed.setAuthor("");
            feed.setLink("");
            List<SyndEntry> entries = new ArrayList<>();
            feed.setEntries(entries);
            aggregateFeeds(urlList, entries, req.getPage());
        }
        // If not an aggregate return the one external feed itself
        else {
            String url = urlList.get(0);
            SyndFeed cachedFeed = getFeed(url, true, 1, 1);
            if (cachedFeed != null) {
                feed = new SyndFeedImpl();
                cloneFeedForPage(feed, cachedFeed, req.getPage());
            }
        }

        if (feed != null) {
            fixFeed(feed);
            boolean addFeedTitles = urlList.size() > 1;
            RssFeed rssFeed = convertToFeed(feed, addFeedTitles);
            res.setFeed(rssFeed);
        }
        // log.debug("FEED RES: " + XString.prettyPrint(res));
        return res;
    }

    public RssFeed convertToFeed(SyndFeed feed, boolean addFeedTitles) {
        RssFeed rf = new RssFeed();
        rf.setTitle(feed.getTitle());
        rf.setDescription(sanitizeHtml(feed.getDescription()));
        rf.setAuthor(feed.getAuthor());
        rf.setEncoding(feed.getEncoding());
        if (feed.getImage() != null) {
            rf.setImage(feed.getImage().getUrl());
        }
        // processModules(feed, rf);
        rf.setLink(feed.getLink());
        List<RssFeedEntry> rssEntries = new LinkedList<>();
        rf.setEntries(rssEntries);
        if (feed.getEntries() != null) {
            for (SyndEntry entry : feed.getEntries()) {
                RssFeedEntry e = new RssFeedEntry();
                if (addFeedTitles) {
                    e.setParentFeedTitle(feedNameOfItem.get(entry.getUri()));
                }
                try {
                    if (processEntry(entry, e)) {
                        // log.debug("Build RSS Ret Obj: " + e.getTitle());
                        rssEntries.add(e);
                    }
                } catch (Exception ex) {
                    log.debug("Failed to Process: " + e.getTitle());
                }
            }
        }
        // log.debug("Returning RSS Display: " + XString.prettyPrint(rf));
        return rf;
    }

    private boolean processEntry(SyndEntry entry, RssFeedEntry e) {
        if (entry.getDescription() != null) {
            e.setDescription(sanitizeHtml(entry.getDescription().getValue()));
        }
        e.setTitle(entry.getTitle());
        e.setLink(entry.getLink());
        if (entry.getPublishedDate() != null) {
            e.setPublishDate(DateUtil.shortFormatDate(entry.getPublishedDate().getTime()));
        } else {
            // log.debug("RSS ENTRY: Missing Pub Date: " + XString.prettyPrint(entry));
        }
        e.setAuthor(entry.getAuthor());
        if (entry.getContents() != null) {
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
        if (entry.getEnclosures() != null) {
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
        return true;
    }

    // private void processModules(SyndFeed entry, RssFeed e) {
    // if (entry.getModules() != null) {
    // for (Module m : entry.getModules()) {
    // if (m instanceof MediaEntryModuleImpl mm) {
    // if (mm.getMediaContents() != null) {
    // // put new list on return object
    // List<RssFeedMediaContent> mediaContent = new LinkedList<>();
    // // add mediaContent to RssFeed ?
    // // e.setMediaContent(mediaContent);
    // // process all media contents
    // for (MediaContent mc : mm.getMediaContents()) {
    // RssFeedMediaContent rfmc = new RssFeedMediaContent();
    // rfmc.setType(mc.getType());
    // rfmc.setUrl(mc.getReference().toString());
    // rfmc.setMedium(mc.getMedium());
    // mediaContent.add(rfmc);
    // }
    // }
    // if (mm.getMediaGroups() != null) {
    // for (MediaGroup mg : mm.getMediaGroups()) {
    // Metadata md = mg.getMetadata();
    // if (md != null) {
    // if (md.getDescription() != null) {
    // e.setDescription(sanitizeHtml(md.getDescription()));
    // }
    // if (md.getEmbed() != null) {
    // log.debug("Metadata Embed Url: " + md.getEmbed().getUrl());
    // }
    // if (md.getThumbnail() != null) {
    // for (Thumbnail tn : mg.getMetadata().getThumbnail()) {
    // e.setImage(tn.getUrl().toASCIIString());
    // }
    // }
    // } else {
    // log.debug("MediaGroup has no metadata.");
    // }
    // }
    // } else {
    // log.debug("media has no groups.");
    // }
    // } //
    // else if (m instanceof ContentModuleImpl) {
    // //
    // } else if (m instanceof EntryInformationImpl itunesMod) {
    // if (itunesMod.getImage() != null) {
    // try {
    // e.setImage(itunesMod.getImage().toURI().toString());
    // } catch (Exception e1) {
    // }
    // } else { // ignore
    // e.setImage(itunesMod.getImageUri());
    // }
    // if (!StringUtils.isEmpty(itunesMod.getTitle())) {
    // e.setTitle(itunesMod.getTitle());
    // }
    // // e.setSubTitle(itunesMod.getSubtitle());
    // if (!StringUtils.isEmpty(itunesMod.getSummary())) {
    // e.setDescription(sanitizeHtml(itunesMod.getSummary()));
    // }
    // } //
    // else if (m instanceof DCModuleImpl) {
    // } else { // log.debug("dcSource: " + dcSource); // String dcTitle = dm.getTitle(); // String
    // dcSource =
    // // dm.getSource(); // String dcFormat = dm.getFormat();
    // // DCModuleImpl dm = (DCModuleImpl) m;
    // log.debug("Unknown module type: " + m.getClass().getName());
    // }
    // }
    // }
    // }

    private void processModules(SyndEntry entry, RssFeedEntry e) {
        if (entry.getModules() != null) {
            for (Module m : entry.getModules()) {
                // log.debug("Module: " + m.getClass().getName());
                if (m instanceof MediaEntryModuleImpl mm) {
                    if (mm.getMediaContents() != null) {
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
                    if (mm.getMediaGroups() != null) {
                        for (MediaGroup mg : mm.getMediaGroups()) {
                            Metadata md = mg.getMetadata();
                            if (md != null) {
                                if (md.getDescription() != null) {
                                    e.setDescription(sanitizeHtml(md.getDescription()));
                                }
                                if (md.getEmbed() != null) {
                                    log.debug("Metadata Embed Url: " + md.getEmbed().getUrl());
                                }
                                if (md.getThumbnail() != null) {
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
                    if (md != null) {
                        if (md.getDescription() != null) {
                            e.setDescription(sanitizeHtml(md.getDescription()));
                        }
                        if (md.getThumbnail() != null) {
                            for (Thumbnail tn : md.getThumbnail()) {
                                e.setThumbnail(tn.getUrl().toASCIIString());
                            }
                        }
                    }
                } //
                else if (m instanceof ContentModuleImpl) {
                } else if (m instanceof EntryInformationImpl itunesMod) {
                    if (itunesMod.getImage() != null) {
                        try {
                            e.setImage(itunesMod.getImage().toURI().toString());
                        } catch (Exception e1) {
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
                } //
                else if (m instanceof DCModuleImpl) {
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
        int startIdx = pageNo * FEED_ITEMS_PER_PAGE;
        int idx = 0;
        // log.debug("Feed: " + cachedFeed.getLink() + " has " + cachedFeed.getEntries().size() + "
        // entries.");

        for (SyndEntry entry : cachedFeed.getEntries()) {
            if (idx >= startIdx) {
                entries.add(entry);
                if (entries.size() >= FEED_ITEMS_PER_PAGE) {
                    break;
                }
            }
            idx++;
        }
    }

    public void getRssFeed(String nodeId, Writer writer) {
        SubNode node = svc_mongoRead.getNode(nodeId);
        SyndFeed feed = new SyndFeedImpl();
        feed.setEncoding("UTF-8");
        feed.setFeedType("rss_2.0");
        NodeMetaInfo metaInfo = svc_snUtil.getNodeMetaInfo(node);
        feed.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "");
        feed.setLink("");
        feed.setDescription(sanitizeHtml(metaInfo.getDescription() != null ? metaInfo.getDescription() : ""));
        List<SyndEntry> entries = new LinkedList<>();
        feed.setEntries(entries);

        if (AclService.isPublic(node)) {
            Criteria crit = Criteria.where(SubNode.AC + "." + PrincipalName.PUBLIC.s()).ne(null);

            // pass no auth here, becasue we already included PUBLIC and everyone can see public.
            Iterable<SubNode> iter =
                    svc_mongoRead.getChildrenAP(node, Sort.by(Sort.Direction.ASC, SubNode.ORDINAL), null, 0, crit);

            if (iter != null) {
                for (SubNode n : iter) {
                    if (!AclService.isPublic(n))
                        continue;
                    metaInfo = svc_snUtil.getNodeMetaInfo(n);
                    // Currently the link will be an attachment URL, but need to research how ROME
                    // handles attachments.
                    if (metaInfo.getAttachmentUrl() == null) {
                        metaInfo.setAttachmentUrl(metaInfo.getUrl());
                    }
                    SyndEntry entry = new SyndEntryImpl();
                    entry.setTitle(metaInfo.getTitle() != null ? metaInfo.getTitle() : "ID: " + n.getIdStr());
                    entry.setLink(metaInfo.getAttachmentUrl() != null ? metaInfo.getAttachmentUrl()
                            : svc_prop.getProtocolHostAndPort());

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

                    description.setType("text/plain");
                    description.setType("text/html");
                    description
                            .setValue(sanitizeHtml(metaInfo.getDescription() != null ? metaInfo.getDescription() : ""));
                    entry.setDescription(description);
                    entries.add(entry);
                }
            }
        }
        writeFeed(feed, writer);
    }

    private void fixFeed(SyndFeed feed) {
        if (feed == null)
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
        if (writer != null && feed != null) {
            try {
                fixFeed(feed);
                SyndFeedOutput output = new SyndFeedOutput();
                boolean prettyPrint = true;
                String feedStr = output.outputString(feed, prettyPrint);
                feedStr = convertStreamChars(feedStr);
                // log.debug("FEED XML: " + feedStr);
                writer.write(feedStr);
            } catch (Exception e) {
                throw new RuntimeEx("writeFeed Error: ", e);
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
    // private String convertMarkdownToHtml() {
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
