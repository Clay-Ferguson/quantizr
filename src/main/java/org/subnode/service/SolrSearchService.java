package org.subnode.service;

import org.springframework.stereotype.Component;

/**
 * Performs searching against some Solr Client (over the network, like a microservice)
 * <p>
 * This was part of a short experiment that was simply left in the code for future reference. There
 * is currently no significant integration with Solr in any meaningful way but this code was part of
 * a proof-of-concept test.
 */
@Component
public class SolrSearchService {
	// private static final Logger log = LoggerFactory.getLogger(SolrSearchService.class);
	//
	// private static final ObjectMapper jsonMapper = new ObjectMapper();
	//
	// @Autowired
	// private AppProp appProp;
	//
	// public void search(Session session, FileSearchRequest req, FileSearchResponse res) {
	// try {
	// if (session == null) {
	// session = ThreadLocals.getJcrSession();
	// }
	//
	// if (!appProp.isAllowFileSystemSearch()) {
	// throw ExUtil.newEx("File system search is not enabled on the server.");
	// }
	//
	// SolrClient solr = new HttpSolrClient.Builder(appProp.getSolrSearchHost()).build();
	//
	// SolrQuery query = new SolrQuery();
	// query.setQuery(req.getSearchText());
	//
	// QueryResponse response = solr.query(query);
	// SolrDocumentList results = response.getResults();
	// List<FileSearchResult> resultList = new LinkedList<FileSearchResult>();
	// for (SolrDocument doc : results) {
	//
	// String fileName = (String) doc.getFirstValue("resourcename");
	//
	// // Here are the fields in a SolrDocument:
	// // id=/home/clay/ferguson/mydoc.txt,
	// // stream_size=[10119],
	// // x_parsed_by=[org.apache.tika.parser.DefaultParser,
	// // org.apache.tika.parser.txt.TXTParser],
	// // stream_content_type=[text/plain],
	// // content_encoding=[UTF-8],
	// // resourcename=[/home/clay/ferguson/mydoc.txt],
	// // content_type=[text/plain; charset=UTF-8],
	// // _version_=1546409258043572224
	//
	// resultList.add(new FileSearchResult(fileName));
	// }
	//
	// String json = jsonMapper.writeValueAsString(resultList);
	// log.debug("RESULT STRING: " + json);
	//
	// SessionContext sessionContext = (SessionContext)
	// SpringContextUtil.getBean(SessionContext.class);
	// String userName = sessionContext.getUserName();
	//
	// Ref_Info rootRef_Info = UserManagerUtil.getRootNodeRef_InfoForUser(session, userName);
	//
	// Node parentNode = JcrUtil.ensureNodeExists(session, rootRef_Info.getPath() + "/",
	// JcrName.FILE_SEARCH_RESULTS, "Search Results");
	// parentNode.setProperty(JcrProp.CREATED_BY, userName);
	// Node newNode = parentNode.addNode(JcrUtil.getGUID(), JcrConstants.NT_UNSTRUCTURED);
	//
	// newNode.setProperty(JcrProp.CONTENT, "prop JSON_FILE_SEARCH_RESULT contains data.");
	// newNode.setProperty(JcrProp.CREATED_BY, userName);
	// newNode.setProperty(JcrProp.JSON_FILE_SEARCH_RESULT, json);
	// JcrUtil.timestampNewNode(session, newNode);
	// JcrUtil.save(session);
	//
	// res.setSearchResultNodeId(newNode.getIdentifier());
	// }
	// catch (Exception ex) {
	// throw ExUtil.newEx(ex);
	// }
	// }
}
