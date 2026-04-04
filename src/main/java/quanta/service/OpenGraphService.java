package quanta.service;

import java.util.ArrayList;
import java.util.List;
import org.apache.commons.collections4.map.LRUMap;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.model.client.NodeProp;
import quanta.model.client.OpenGraph;
import quanta.mongo.model.SubNode;
import quanta.rest.request.GetOpenGraphRequest;
import quanta.rest.response.GetOpenGraphResponse;
import quanta.util.MimeUtil;
import quanta.util.XString;

@Component
public class OpenGraphService extends ServiceBase {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(OpenGraphService.class);

    // private Pattern urlPattern = Pattern.compile("(https?:\\/\\/[^\\s]+)",
    // Pattern.CASE_INSENSITIVE);
    private final LRUMap<String, OpenGraph> ogCache = new LRUMap<>(1000);
    private static final String BROWSER_USER_AGENT =
            "Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36";

    public GetOpenGraphResponse cm_getOpenGraph(GetOpenGraphRequest ogReq) {
        GetOpenGraphResponse res = new GetOpenGraphResponse();
        res.setOpenGraph(getOpenGraph(ogReq.getUrl()));
        return res;
    }

    /**
     * Retrieves the OpenGraph data for a given URL. If the URL has been previously cached, the cached
     * data is returned. Otherwise, the OpenGraph data is parsed from the URL and cached for future use.
     *
     * @param url the URL to retrieve OpenGraph data for
     * @return the OpenGraph data for the given URL
     */
    public OpenGraph getOpenGraph(String url) {
        url = XString.stripIfEndsWith(url, "/");
        url = XString.stripIfEndsWith(url, "\\");

        // if the url is cached (even if null) then return whatever's in the cache
        synchronized (ogCache) {
            if (ogCache.containsKey(url)) {
                return ogCache.get(url);
            }
        }

        OpenGraph openGraph = null;
        try {
            openGraph = parseOpenGraph(url);
        } catch (Exception e) {
            String mime = MimeUtil.getMimeTypeFromUrl(url);
            openGraph = new OpenGraph();
            openGraph.setMime(mime);
        }

        // we can't trust what we get back from servers, but we do need to be sure URL
        // is correct here ourselves.
        openGraph.setUrl(url);

        // we allow storing a null if we got back a null. Cache it so we don't try
        // again.
        synchronized (ogCache) {
            ogCache.put(url, openGraph);
        }
        return openGraph;
    }

    /**
     * Parses the Open Graph metadata from the given URL.
     *
     * @param urlStr the URL of the web page to parse
     * @return an OpenGraph object containing the parsed metadata
     * @throws Exception if an error occurs while connecting to the URL or parsing the document
     */
    public OpenGraph parseOpenGraph(String urlStr) throws Exception {
        OpenGraph openGraph = new OpenGraph();
        Connection con = Jsoup.connect(urlStr);
        con.timeout(5000);
        /*
         * this browseragent thing is important to trick servers into sending us the LARGEST versions of the
         * images
         */
        con.userAgent(BROWSER_USER_AGENT);
        Document doc = con.get();

        // todo-2: add site_name, type, url, twitter:url, twitter:card (like og:type)
        openGraph.setTitle(getOg(doc, "og:title"));
        if (openGraph.getTitle() == null) {
            openGraph.setTitle(getOg(doc, "twitter:title"));
        }
        openGraph.setUrl(getOg(doc, "og:url"));
        if (openGraph.getUrl() == null) {
            openGraph.setUrl(getOg(doc, "twitter:url"));
        }
        openGraph.setDescription(getOg(doc, "og:description"));
        if (openGraph.getDescription() == null) {
            openGraph.setDescription(getOg(doc, "twitter:description"));
        }
        openGraph.setImage(getOg(doc, "og:image"));
        if (openGraph.getImage() == null) {
            openGraph.setImage(getOg(doc, "twitter:image"));
        }
        return openGraph;
    }

    private String getOg(Document doc, String prop) {
        Elements elm = doc.select("meta[property=" + prop + "]");
        return elm != null ? elm.attr("content") : null;
    }

    /*
     * Parses the content for any HTML links and attempts to get the OpenGraph from the network and puts
     * the opengraph object into node properties.
     * 
     * todo-3: for now this method is 'cumulative' and never removes unused OG entries like if a node is
     * edited (unless all HTTPs text is removed), but we will take care of that when we are calling this
     * during SAVEs.
     */
    public void parseNode(SubNode node) {
        // if we have no text content at all, clear the OPEN_GRAPH property and return
        if (StringUtils.isEmpty(node.getContent())) {
            node.set(NodeProp.OPEN_GRAPH.s(), null);
            return;
        }

        // if we have no http or https links in the content, clear the OPEN_GRAPH property and return
        if (node.getContent().toLowerCase().indexOf("http://") == -1
                && node.getContent().toLowerCase().indexOf("https://") == -1) {
            node.set(NodeProp.OPEN_GRAPH.s(), null);
            return;
        }

        // if we have no http or https links in the content, clear the OPEN_GRAPH property and return
        List<String> lines = XString.tokenize(node.getContent(), "\n", true);
        if (lines == null || lines.size() == 0) {
            node.set(NodeProp.OPEN_GRAPH.s(), null);
            return;
        }

        // record current time and time of last update (or 0L if no last update set yet)
        Long timeNow = System.currentTimeMillis();
        Long lastUpdate = node.getInt(NodeProp.OPEN_GRAPH_LAST_UPDATE);

        // if we have a last update and it's more than 7 days ago set forceReRead to
        // true
        boolean forceReRead = false;
        if ((timeNow - lastUpdate) > 604800000L) {
            forceReRead = true;
        }

        ArrayList<String> ogList = null;

        // iterate through each url and cache it
        for (String line : lines) {
            if (!line.contains("http"))
                continue;
            String url = null;

            // startingn line with "* http" means do not render opengraph
            if (line.startsWith("* ")) {
                continue;
            } else if (line.startsWith("- ")) {
                line = line.substring(2);
            } else if (line.startsWith("-- ")) {
                line = line.substring(3);
            }

            if (line.startsWith("http://") || line.startsWith("https://")) {
                url = line;
            } else {
                continue;
            }

            if (ogList == null) {
                ogList = new ArrayList<>();
            }

            // Stripping trailing slashes is a hack because my regex isn't perfect (todo-3:
            // fix the regex)
            url = XString.stripIfEndsWith(url, "/");
            url = XString.stripIfEndsWith(url, "\\");

            if (!forceReRead) {
                // set load=false if we already have this URL in our ogList
                boolean load = true;

                for (String urlCheck : ogList) {
                    // just finding the URL is a hack but will be fine for now, to avoid parsing
                    // JSON
                    if (urlCheck.contains(url)) {
                        load = false;
                        break;
                    }
                }
                if (!load) {
                    continue;
                }
            }

            OpenGraph og = getOpenGraph(url);
            String ogStr = XString.compactPrint(og);
            ogList.add(ogStr);

            // if more than 10 links in content then ignore the rest
            if (ogList.size() > 10) {
                break;
            }
        }
        node.set(NodeProp.OPEN_GRAPH.s(), ogList);
        node.set(NodeProp.OPEN_GRAPH_LAST_UPDATE.s(), timeNow);
    }
}
