package org.subnode.service;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.subnode.config.AppProp;
import org.subnode.lucene.FileIndexer;
import org.subnode.lucene.FileSearcher;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.MongoSession;
import org.subnode.mongo.model.SubNode;
import org.subnode.request.LuceneIndexRequest;
import org.subnode.response.LuceneIndexResponse;

/**
 * Service for processing Lucene-related functions.
 */
@Component
public class LuceneService {
	private static final Logger log = LoggerFactory.getLogger(LuceneService.class);

	private static final ObjectMapper jsonMapper = new ObjectMapper();

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	@Autowired
	private UserManagerService userManagerService;

	@Autowired
	private FileIndexer fileIndexer;

	@Autowired
	private FileSearcher searcher;

	public String reindex(MongoSession session, String nodeId, String searchFolder) {
		String ret = null;
		SubNode node = api.getNode(session, nodeId, true);
		if (node!=null) {
			//Remember 'searchFolder' will have to be visible to the VM and therefore this might require adding
			//a new  mapping parameter to the startup shell script for docker. Docker can't see the entire folder structure
			//on the host machine, but can only see what has specifically been shared to it.
			//
			//NOTE: We're using the nodeId as the subdirectory in the lucene data folder to keep the index of this node
			//garanteed to be separate but determined by this node (i.e. unique to this node)
			fileIndexer.index(searchFolder /* "/subnode-tmp/search" */, nodeId, "sh,md,txt,pdf,zip,tar,json,gz,tgz,xz", true);
			ret = fileIndexer.getSummaryReport();
			fileIndexer.close();
		}
		return ret;
	}

	public String search(MongoSession session, String nodeId, String searchText) {
		String ret = null;
		SubNode node = api.getNode(session, nodeId, true);
		if (node!=null) {
			ret = searcher.search(nodeId, searchText);
		}
		return ret;
	}
}

