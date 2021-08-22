package org.subnode.service;

import java.util.concurrent.ConcurrentHashMap;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.subnode.model.client.OpenGraph;
import org.subnode.request.GetOpenGraphRequest;
import org.subnode.response.GetOpenGraphResponse;

@Component
public class JSoupService {
	public final ConcurrentHashMap<String, OpenGraph> ogCache = new ConcurrentHashMap<>();

	public static final String BROWSER_USER_AGENT =
			"Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36";

	private static final Logger log = LoggerFactory.getLogger(JSoupService.class);

	public GetOpenGraphResponse getOpenGraph(GetOpenGraphRequest ogReq) {
		GetOpenGraphResponse res = new GetOpenGraphResponse();
		OpenGraph openGraph = ogCache.get(ogReq.getUrl());

		if (openGraph != null) {
			res.setOpenGraph(openGraph);
		} else {
			try {
				openGraph = parseOpenGraph(ogReq.getUrl());
				if (openGraph != null) {
					ogCache.put(ogReq.getUrl(), openGraph);
				}
				res.setOpenGraph(openGraph);
			} catch (Exception e) {
				// ignore this error, for now (todo-1)
				// ExUtil.error(log, "failed parsing OpenGraph", e);
			}
		}
		return res;
	}

	public OpenGraph parseOpenGraph(String urlStr) throws Exception {
		// log.debug("JSoup parsing Images from URL: " + urlStr);
		OpenGraph openGraph = new OpenGraph();
		Connection con = Jsoup.connect(urlStr);

		/*
		 * this browseragent thing is important to trick servers into sending us the LARGEST versions of the
		 * images
		 */
		con.userAgent(BROWSER_USER_AGENT);
		Document doc = con.get();

		// todo-1: add site_name, type, url, twitter:url, twitter:card (like og:type)

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
}
