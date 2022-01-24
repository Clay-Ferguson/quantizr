package quanta.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import quanta.CallProcessor;
import quanta.actpub.ActPubCache;
import quanta.actpub.ActPubCrypto;
import quanta.actpub.ActPubFactory;
import quanta.actpub.ActPubFollower;
import quanta.actpub.ActPubFollowing;
import quanta.actpub.ActPubOutbox;
import quanta.actpub.ActPubService;
import quanta.actpub.ActPubUtil;
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
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.service.AclService;
import quanta.service.AttachmentService;
import quanta.service.GraphNodesService;
import quanta.service.IPFSPubSub;
import quanta.service.IPFSService;
import quanta.service.ImportBookService;
import quanta.service.ImportService;
import quanta.service.JSoupService;
import quanta.service.LuceneService;
import quanta.service.NodeEditService;
import quanta.service.NodeMoveService;
import quanta.service.NodeRenderService;
import quanta.service.NodeSearchService;
import quanta.service.PushService;
import quanta.service.RSSFeedService;
import quanta.service.SystemService;
import quanta.service.UserFeedService;
import quanta.service.UserManagerService;
import quanta.types.BookmarkType;
import quanta.types.FriendType;
import quanta.types.RoomType;
import quanta.types.RssFeedType;
import quanta.types.TypePluginMgr;
import quanta.util.AsyncExec;
import quanta.util.Convert;
import quanta.util.EnglishDictionary;
import quanta.util.FileUtils;
import quanta.util.MimeUtil;
import quanta.util.SubNodeUtil;
import quanta.util.Validator;

/**
 * We have lots of circular references in our services, and since SpringBoot has decided it doesn't
 * support that without setting a flag to disable checking, I just solved it in this monolithic way.
 * 
 * To make all services able to access other services we break convention here and use inheritance
 * in a non "is-a" way, which is normally bad practice. However the benefit to this small design
 * choice is huge in numbers of saved lines of code. The fact that it creates a monolith of all
 * these services is fine too, because none of this code shares to other projects. Also since
 * Services are a type of class that really never need to derive from other base classes, it's
 * perfectly acceptable to use the same base class across all of them so they can all reference each
 * other using a simple "object.property" syntax.
 */
public class ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(ServiceBase.class);

	@Autowired
	private ApplicationContext ctx;

	// todo-0: All these need to be initialized AFTER spring beans are created (using getBean(clazz))
	// rather than in the
	// @PostConstruct (by setting to 'this') becasue setting to 'this' will not get a reference to the
	// Spring PROXY Object, and that will therefore break AOP (stop any AOP from working)
	public static UserFeedService userFeed;
	public static Convert convert;
	public static TypePluginMgr typePluginMgr;
	public static MongoCreate create;
	public static MongoRead read;
	public static MongoUpdate update;
	public static MongoDelete delete;
	public static MongoAuth auth;
	public static MongoUtil mongoUtil;
	public static SubNodeUtil snUtil;
	public static AclService acl;
	public static UserManagerService user;
	public static AdminRun arun;
	public static IPFSService ipfs;
	public static IPFSPubSub ipfsPubSub;
	public static AttachmentService attach;
	public static ActPubService apub;
	public static NodeRenderService render;
	public static NodeEditService edit;
	public static ActPubCache apCache;
	public static Validator validator;
	public static OutboxMgr outbox;
	public static EmailSenderDaemon notify;
	public static EmailSender mail;
	public static PushService push;
	public static ActPubUtil apUtil;
	public static ActPubFollower apFollower;
	public static ActPubFollowing apFollowing;
	public static GraphNodesService graphNodes;
	public static ActPubOutbox apOutbox;
	public static EnglishDictionary english;
	public static AsyncExec exec;
	public static NodeSearchService search;
	public static CallProcessor callProc;
	public static NodeMoveService move;
	public static ImportBookService importBookService;
	public static ActPubCrypto apCrypto;
	public static ImportService importService;
	public static LuceneService lucene;
	public static FileIndexer fileIndexer;
	public static SystemService system;
	public static RSSFeedService rssFeed;
	public static JSoupService jsoup;
	public static ActPubFactory apFactory;
	public static FileUtils fileUtil;
	public static MimeUtil mimeUtil;
	public static MongoAppConfig mac;

	public static BookmarkType bookmarkType;
	public static FriendType friendType;
	public static RoomType roomType;
	public static RssFeedType rssType;

	public static MongoTemplate ops;
	public static MongoRepository mongoRepo;
	public static SimpleMongoClientDatabaseFactory mdbf;

	public ServiceBase() {
		log.debug("ServiceBase: " + getClass().getName());
	}

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		log.debug("Setting ServiceBase Proxy Instances...");
		
		// public static UserFeedService userFeed;
		// public static Convert convert;
		// public static TypePluginMgr typePluginMgr;
		// public static MongoCreate create;
		read = ctx.getBean(MongoRead.class);
		// public static MongoUpdate update;
		// public static MongoDelete delete;
		auth = ctx.getBean(MongoAuth.class);
		// public static MongoUtil mongoUtil;
		// public static SubNodeUtil snUtil;
		// public static AclService acl;
		// public static UserManagerService user;
		// public static AdminRun arun;
		// public static IPFSService ipfs;
		// public static IPFSPubSub ipfsPubSub;
		// public static AttachmentService attach;
		// public static ActPubService apub;
		// public static NodeRenderService render;
		// public static NodeEditService edit;
		// public static ActPubCache apCache;
		// public static Validator validator;
		// public static OutboxMgr outbox;
		// public static EmailSenderDaemon notify;
		// public static EmailSender mail;
		// public static PushService push;
		// public static ActPubUtil apUtil;
		// public static ActPubFollower apFollower;
		// public static ActPubFollowing apFollowing;
		// public static GraphNodesService graphNodes;
		// public static ActPubOutbox apOutbox;
		// public static EnglishDictionary english;
		// public static AsyncExec exec;
		// public static NodeSearchService search;
		// public static CallProcessor callProc;
		// public static NodeMoveService move;
		// public static ImportBookService importBookService;
		// public static ActPubCrypto apCrypto;
		// public static ImportService importService;
		// public static LuceneService lucene;
		// public static FileIndexer fileIndexer;
		// public static SystemService system;
		// public static RSSFeedService rssFeed;
		// public static JSoupService jsoup;
		// public static ActPubFactory apFactory;
		// public static FileUtils fileUtil;
		// public static MimeUtil mimeUtil;
		// public static MongoAppConfig mac;

		// public static BookmarkType bookmarkType;
		// public static FriendType friendType;
		// public static RoomType roomType;
		// public static RssFeedType rssType;

		// public static MongoTemplate ops;
		// public static MongoRepository mongoRepo;
		// public static SimpleMongoClientDatabaseFactory mdbf;
	}
}
