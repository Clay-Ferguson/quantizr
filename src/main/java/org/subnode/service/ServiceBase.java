package org.subnode.service;

import com.mongodb.client.gridfs.GridFSBucket;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Component;
import org.subnode.actpub.ActPubCache;
import org.subnode.actpub.ActPubCrypto;
import org.subnode.actpub.ActPubFactory;
import org.subnode.actpub.ActPubFollower;
import org.subnode.actpub.ActPubFollowing;
import org.subnode.actpub.ActPubOutbox;
import org.subnode.actpub.ActPubService;
import org.subnode.actpub.ActPubUtil;
import org.subnode.config.AppProp;
import org.subnode.lucene.FileIndexer;
import org.subnode.mail.MailSender;
import org.subnode.mail.NotificationDaemon;
import org.subnode.mail.OutboxMgr;
import org.subnode.mongo.AdminRun;
import org.subnode.mongo.MongoAppConfig;
import org.subnode.mongo.MongoAuth;
import org.subnode.mongo.MongoCreate;
import org.subnode.mongo.MongoDelete;
import org.subnode.mongo.MongoRead;
import org.subnode.mongo.MongoUpdate;
import org.subnode.mongo.MongoUtil;
import org.subnode.types.TypePluginMgr;
import org.subnode.util.AsyncExec;
import org.subnode.util.Convert;
import org.subnode.util.EnglishDictionary;
import org.subnode.util.FileUtils;
import org.subnode.util.MimeUtil;
import org.subnode.util.SubNodeUtil;
import org.subnode.util.Validator;

/*
 * Give all @Components access to all other components. This is a desireable and intentional
 * "monolith" and we intentionally break some OOP conventions here because "Services" (singletons)
 * aren't enough of a significant member of any object hiearachy to need to adhere to the
 * conventional OOP rules. There are no disadvantages whatsoever to doing this, and huge advantages
 * in keeping code clean.
 */
@Component
public class ServiceBase {
	@Autowired
	protected MongoTemplate ops;

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
	protected MailSender mail;

	@Autowired
	protected NotificationDaemon notify;
}

