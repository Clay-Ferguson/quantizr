package quanta.service;

import com.mongodb.client.gridfs.GridFSBucket;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;
import quanta.actpub.ActPubCache;
import quanta.actpub.ActPubCrypto;
import quanta.actpub.ActPubFactory;
import quanta.actpub.ActPubFollower;
import quanta.actpub.ActPubFollowing;
import quanta.actpub.ActPubOutbox;
import quanta.actpub.ActPubService;
import quanta.actpub.ActPubUtil;
import quanta.config.AppProp;
import quanta.lucene.FileIndexer;
import quanta.mail.EmailSender;
import quanta.mail.EmailSenderDaemon;
import quanta.mail.OutboxMgr;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoAppConfig;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoDelete;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.types.TypePluginMgr;
import quanta.util.AsyncExec;
import quanta.util.Convert;
import quanta.util.EnglishDictionary;
import quanta.util.FileUtils;
import quanta.util.MimeUtil;
import quanta.util.SubNodeUtil;
import quanta.util.Validator;

/*
 * Give all @Components access to all other components. This is a desireable and intentional
 * "monolith" and we intentionally break some OOP conventions here because "Services" (singletons)
 * aren't enough of a significant member of any object hiearachy to need to adhere to the
 * conventional OOP rules. There are no disadvantages whatsoever to doing this, and huge advantages
 * in keeping code clean.
 */
public class ServiceBase {
	@Autowired
	protected MongoCreate create;

	@Autowired
	protected MongoRead read;

	@Autowired
	protected MongoUpdate update;

	@Autowired
	protected MongoDelete delete;

	@Autowired
	protected MongoAuth auth;

	@Autowired
	protected MongoUtil mongoUtil;

	@Autowired
	protected MongoAppConfig mac;

	@Autowired
	protected AclService acl;

	@Autowired
	protected UserManagerService user;

	@Autowired
	protected AppProp prop;

	@Autowired
	protected GridFsTemplate grid;

	@Autowired
	protected GridFSBucket gridBucket;

	@Autowired
	protected IPFSService ipfs;

	@Autowired
	protected AdminRun arun;

	@Autowired
	protected SubNodeUtil snUtil;

	@Autowired
	protected AttachmentService attach;

	@Autowired
	protected FileUtils fileUtil;

	@Autowired
	protected MimeUtil mimeUtil;

	@Autowired
	protected AsyncExec asyncExec;

	@Autowired
	protected FileIndexer fileIndexer;

	@Autowired
	protected Convert convert;

	@Autowired
	protected NodeRenderService render;

	@Autowired
	protected ActPubService apub;

	@Autowired
	protected ActPubFollowing apFollowing;

	@Autowired
	protected ActPubFollower apFollower;

	@Autowired
	protected ActPubOutbox apOutbox;

	@Autowired
	protected ActPubUtil apUtil;

	@Autowired
	public ActPubCache apCache;

	@Autowired
	protected ActPubCrypto apCrypto;

	@Autowired
	protected ActPubFactory apFactory;

	@Autowired
	protected TypePluginMgr typePluginMgr;

	@Autowired
	protected PushService push;

	@Autowired
	protected EnglishDictionary english;

	@Autowired
	protected OutboxMgr outbox;

	@Autowired
	protected Validator validator;

	@Autowired
	protected NodeEditService edit;

	@Autowired
	protected EmailSender mail;

	@Autowired
	protected EmailSenderDaemon notify;

	@Autowired
	protected NodeSearchService search;

	@Autowired
	protected NodeMoveService move;

	@Autowired
	protected JSoupService jsoup;

	@Autowired
	protected UserFeedService userFeed;

	@Autowired
	protected RSSFeedService rssFeed;

	@Autowired
	protected GraphNodesService graphNodes;

	@Autowired
	protected ImportService importService;

	@Autowired
	protected ImportBookService importBookService;

	@Autowired
	protected SystemService system;

	@Autowired
	protected LuceneService lucene;
}

