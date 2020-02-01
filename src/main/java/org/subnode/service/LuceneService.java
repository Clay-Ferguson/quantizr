package org.subnode.service;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.subnode.config.AppProp;
import org.subnode.lucene.FileIndexer;
import org.subnode.lucene.FileSearcher;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;

/**
 * Service for processing Lucene-related functions.
 */
@Component
public class LuceneService {
	private static final Logger log = LoggerFactory.getLogger(LuceneService.class);

	@Autowired
	private MongoApi api;

	@Autowired
	private FileIndexer fileIndexer;

	@Autowired
	private FileSearcher searcher;

	public String reindex(MongoSession session, String nodeId, String searchFolder) {
		String ret = null;
		SubNode node = api.getNode(session, nodeId, true);
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
			fileIndexer.index(searchFolder /* "/subnode-tmp/search" */, nodeId, "sh,md,txt,pdf,zip,tar,json,gz,tgz,xz",
					true);
			ret = fileIndexer.getSummaryReport();
			fileIndexer.close();
		}
		return ret;
	}

	public String search(MongoSession session, String nodeId, String searchText) {
		String ret = null;
		SubNode node = api.getNode(session, nodeId, true);
		if (node != null) {
			ret = searcher.search(nodeId, searchText);
		}
		return ret;
	}
}
