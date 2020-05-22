package org.subnode.util;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Scope;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import org.subnode.config.SpringContextUtil;
import org.subnode.model.client.NodeType;
import org.subnode.mongo.CreateNodeLocation;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

/**
 * Reads the special proprietary-formatted file of the book 'War and Peace' to load into the
 * repository, because we use this book as sample/example content.
 */
@Component
@Scope("prototype")
public class ImportWarAndPeace {
	private static final Logger log = LoggerFactory.getLogger(ImportWarAndPeace.class);

	@Autowired
	private MongoApi api;

	private int maxLines = Integer.MAX_VALUE;
	private int maxBooks = Integer.MAX_VALUE;

	private boolean debug = false;
	private SubNode root;
	private SubNode curBook;
	private SubNode curChapter;

	StringBuilder paragraph = new StringBuilder();

	private int globalBook = 0;
	private int globalChapter = 0;
	private int globalVerse = 0;
	private boolean halt;
	private MongoSession session;

	public void importBook(MongoSession session, String resourceName, SubNode root, int maxBooks) {
		try {
			this.root = root;
			this.session = session;
			this.maxBooks = maxBooks;
			Resource resource = SpringContextUtil.getApplicationContext().getResource(resourceName);
			InputStream is = resource.getInputStream();
			BufferedReader in = new BufferedReader(new InputStreamReader(is));

			try {
				String line;
				int lineCount = 0;

				while (!halt && (line = in.readLine()) != null) {
					line = line.trim();

					/*
					 * if we see a blank line we add the current paragraph text as a node and
					 * continue
					 */
					if (line.length() == 0) {
						if (paragraph.length() > 0) {
							addParagraph();
						}
						continue;
					}

					if (debug) {
						log.debug("INPUT: " + line);
					}

					/*
					 * if we processed the chapter, the last paragraph is also added before starting
					 * the new chapter
					 */
					if (processChapter(line)) {
						continue;
					}

					/*
					 * if we processed the book, the last paragraph is also added before starting
					 * the new book
					 */
					if (processBook(line)) {
						continue;
					}
					if (globalBook > maxBooks) break;

					/* keep appending each line to the current paragraph */
					if (paragraph.length() > 0) {
						paragraph.append(" ");
					}
					paragraph.append(line);

					if (++lineCount > maxLines) break;
				}
			}
			finally {
				StreamUtil.close(in);
			}
			log.debug("book import successful.");
		}
		catch (Exception ex) {
			throw ExUtil.wrapEx(ex);
		}
	}

	private boolean processChapter(String line) {
		if (line.startsWith("CHAPTER ")) {
			globalChapter++;
			log.debug("Processing Chapter: " + line);
			if (curBook == null) throw ExUtil.wrapEx("book is null.");

			addParagraph();

			curChapter = api.createNode(session, curBook, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST);
			curChapter.setContent("C" + String.valueOf(globalChapter) + ". " + line);
			api.save(session, curChapter);
			return true;
		}

		return false;
	}

	private boolean addParagraph() {
		String line = paragraph.toString();

		/*
		 * remove any places where my algorithm stuffed an extra space that just happened to be at a
		 * sentence end
		 */
		line = line.replace(".   ", ".  ");

		if (line.length() == 0) return false;
		if (curChapter == null || curBook == null) return false;
		globalVerse++;

		// line = XString.injectForQuotations(line);

		SubNode paraNode = api.createNode(session, curChapter, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST);
		paraNode.setContent("VS" + globalVerse + ". " + line);
		api.save(session, paraNode);
		paragraph.setLength(0);
		return true;
	}

	private boolean anyEpilogue(String line) {
		return line.startsWith("FIRST EPILOGUE") || //
				line.startsWith("SECOND EPILOGUE") || //
				line.startsWith("THIRD EPILOGUE") || //
				line.startsWith("FOURTH EPILOGUE");
	}

	private boolean processBook(String line) {
		if (line.startsWith("BOOK ") || anyEpilogue(line)) {
			globalBook++;
			if (globalBook > maxBooks) return false;
			addParagraph();

			curBook = api.createNode(session, root, NodeType.NONE.s(), 0L, CreateNodeLocation.LAST);
			curBook.setContent("B" + String.valueOf(globalBook) + ". " + line);
			api.save(session, curBook);
			return true;
		}
		return false;
	}
}

