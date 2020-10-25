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
import org.subnode.model.NodeMetaInfo;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.util.SubNodeUtil;

/* Proof of Concept RSS Publishing */
@Component
public class RSSFeedService {
	private static final Logger log = LoggerFactory.getLogger(RSSFeedService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private SubNodeUtil subNodeUtil;

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
		feed.setLink("https://quanta.wiki"); // todo-0: put real link here
		feed.setDescription(content);

		List<SyndEntry> entries = new LinkedList<SyndEntry>();

		final Iterable<SubNode> iter = read.getChildren(mongoSession, node,
				Sort.by(Sort.Direction.ASC, SubNode.FIELD_ORDINAL), null, 0);
		final List<SubNode> children = read.iterateToList(iter);

		if (children != null) {
			for (final SubNode n : children) {
				NodeMetaInfo metaInfo = subNodeUtil.getNodeMetaInfo(n);

				// Currently the link will be an attachment URL, but need to research how ROME handles attachments.
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
				 * todo-1: NOTE: I tried putting some HTML into 'content' as a test and setting the mime
				 * type, but it doesn't render correctly, so I just need to research how to get
				 * HTML in RSS descriptions, but this is low priority for now so I'm not doing
				 * it yet
				 */
				description.setType("text/plain");
				// description.setType("text/html");
				description.setValue(metaInfo.getDescription() != null ? metaInfo.getDescription() : "");

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
