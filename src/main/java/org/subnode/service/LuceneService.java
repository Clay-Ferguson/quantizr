package org.subnode.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.subnode.lucene.FileIndexer;
import org.subnode.lucene.FileSearcher;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.response.LuceneIndexResponse;
import org.subnode.response.LuceneSearchResponse;

/**
 * Service for processing Lucene-related functions.
 */
@Component
public class LuceneService {
	private static final Logger log = LoggerFactory.getLogger(LuceneService.class);

	@Autowired
	private MongoRead read;

	@Autowired
	private FileIndexer fileIndexer;

	@Autowired
	private FileSearcher searcher;

	public LuceneIndexResponse reindex(MongoSession session, String nodeId, String searchFolder) {
		LuceneIndexResponse res = new LuceneIndexResponse();
		String ret = null;
		SubNode node = read.getNode(session, nodeId, true);
		if (node != null) {
			/*
			 * Remember 'searchFolder' will have to be visible to the VM and therefore this
			 * might require adding a new mapping parameter to the startup shell script for
			 * docker. Docker can't see the entire folder structure on the host machine, but
			 * can only see what has specifically been shared to it.
			 * 
			 * NOTE: We're using the nodeId as the subdirectory in the lucene data folder to
			 * keep the index of this node garanteed to be separate but determined by this
			 * node (i.e. unique to this node)
			 */
			fileIndexer.index(searchFolder /* "/tmp/search" */, nodeId, "sh,md,txt,pdf,zip,tar,json,gz,tgz,xz",
					true);
			ret = fileIndexer.getSummaryReport();
			fileIndexer.close();
		}

		res.setSuccess(true);
		res.setMessage(ret);
		return res;
	}

	public LuceneSearchResponse search(MongoSession session, String nodeId, String searchText) {
		LuceneSearchResponse res = new LuceneSearchResponse();
		String ret = null;
		SubNode node = read.getNode(session, nodeId, true);
		if (node != null) {
			ret = searcher.search(nodeId, searchText);
		}

		res.setSuccess(true);
		res.setMessage(ret);
		return res;
	}
}
