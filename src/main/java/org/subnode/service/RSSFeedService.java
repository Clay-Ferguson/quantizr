package org.subnode.service;

import java.io.Writer;
import java.util.LinkedList;
import java.util.List;

import com.rometools.rome.feed.synd.SyndContent;
import com.rometools.rome.feed.synd.SyndContentImpl;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndEntryImpl;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.feed.synd.SyndFeedImpl;
import com.rometools.rome.io.SyndFeedOutput;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.subnode.exception.NodeAuthFailedException;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

/* Proof of Concept RSS Publishing */
@Component
public class RSSFeedService {
	private static final Logger log = LoggerFactory.getLogger(RSSFeedService.class);

	@Autowired
	private MongoRead read;

	public void getRssFeed(MongoSession mongoSession, String nodeId, Writer writer) {

		SubNode node = null;
		try {
			node = read.getNode(mongoSession, nodeId);
		} catch (NodeAuthFailedException e) {
			return;
		}

		SyndFeed feed = new SyndFeedImpl();
		feed.setFeedType("rss_2.0");

		String content = node.getContent();
		if (StringUtils.isEmpty(content)) {
			content = "n/a";
		}

		feed.setTitle("Quanta RSS Feed - Poof of Concept");
		feed.setLink("https://quanta.wiki"); // todo-0: put real link here.
		feed.setDescription(content);

		List<SyndEntry> entries = new LinkedList<SyndEntry>();

		final Iterable<SubNode> iter = read.getChildren(mongoSession, node,
				Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		if (children != null) {
			for (final SubNode n : children) {
				content = n.getContent();
				if (StringUtils.isEmpty(content)) {
					content = "n/a";
				}
				SyndEntry entry = new SyndEntryImpl();
				entry.setTitle("ID: " + n.getId().toHexString());
				entry.setLink("https://quanta.wiki"); // todo-0: put real link here.
				// entry.setPublishedDate(DATE_PARSER.parse("2004-06-08"));
				SyndContent description = new SyndContentImpl();
				description.setType("text/plain");
				description.setValue(content); // todo-0: convert to HTML (see PDF stuff), and encode (does ROME
												// encode?)
				entry.setDescription(description);
				entries.add(entry);
			}
		}

		feed.setEntries(entries);

		SyndFeedOutput output = new SyndFeedOutput();
		try {
			output.output(feed, writer);
		} catch (Exception e) {
			throw new RuntimeException("internal server error");
		}
	}
}
