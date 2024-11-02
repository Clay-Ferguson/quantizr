package quanta.config;

import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import quanta.mongo.AdminRun;
import quanta.mongo.MongoAppConfig;
import quanta.mongo.MongoAuth;
import quanta.mongo.MongoCreate;
import quanta.mongo.MongoDelete;
import quanta.mongo.MongoRead;
import quanta.mongo.MongoRepository;
import quanta.mongo.MongoTemplateWrapper;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.postgres.DatabaseService;
import quanta.postgres.PaymentService;
import quanta.postgres.repo.TranRepository;
import quanta.postgres.repo.UserRepository;
import quanta.service.AIService;
import quanta.service.AclService;
import quanta.service.AttachmentService;
import quanta.service.CryptoService;
import quanta.service.EmailService;
import quanta.service.FinancialReport;
import quanta.service.FriendService;
import quanta.service.GraphNodesService;
import quanta.service.MongoTransactional;
import quanta.service.NodeEditService;
import quanta.service.NodeMoveService;
import quanta.service.NodeRenderService;
import quanta.service.NodeSearchService;
import quanta.service.OpenGraphService;
import quanta.service.PostgresTransactional;
import quanta.service.PublicationService;
import quanta.service.PushService;
import quanta.service.RSSFeedService;
import quanta.service.RedisService;
import quanta.service.SchemaOrgService;
import quanta.service.SystemService;
import quanta.service.TransferService;
import quanta.service.UserFeedService;
import quanta.service.UserManagerService;
import quanta.service.imports.ImportService;
import quanta.test.TestUtil;
import quanta.types.AIAnswerType;
import quanta.types.BookmarkType;
import quanta.types.CalendarType;
import quanta.types.FriendType;
import quanta.types.RssFeedType;
import quanta.types.TypePluginMgr;
import quanta.util.AIUtil;
import quanta.util.AsyncExec;
import quanta.util.CallProcessor;
import quanta.util.Convert;
import quanta.util.EnglishDictionary;
import quanta.util.EventPublisher;
import quanta.util.FileUtils;
import quanta.util.MimeUtil;
import quanta.util.SubNodeUtil;
import quanta.util.Validator;

/**
 * We have lots of circular references in our services, and since SpringBoot has decided it doesn't
 * support circular refs without setting a flag to disable checking, I solved this problem in this
 * monolithic way, because I don't consider circular references among singleton beans to be a bad
 * thing, nor am I going to refactor a million line of code to eliminate them because of this flawed
 * and presumptuious opinionated decision made by Spring Boot developers.
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
    private static Logger log = LoggerFactory.getLogger(ServiceBase.class);

    static List<Runnable> postConstructs = new ArrayList<>();
    public static ApplicationContext context;

    public static TestUtil svc_testUtil;
    public static TranRepository svc_tranRepo;
    public static UserRepository svc_userRepo;
    public static EventPublisher svc_pub;
    public static AppProp svc_prop;
    public static UserFeedService svc_userFeed;
    public static Convert svc_convert;
    public static TypePluginMgr svc_typeMgr;
    public static MongoCreate svc_mongoCreate;
    public static MongoRead svc_mongoRead;
    public static MongoUpdate svc_mongoUpdate;
    public static MongoDelete svc_mongoDelete;
    public static MongoAuth svc_auth;
    public static MongoUtil svc_mongoUtil;
    public static SubNodeUtil svc_snUtil;
    public static AIUtil svc_aiUtil;
    public static AclService svc_acl;
    public static UserManagerService svc_user;
    public static RedisService svc_redis;
    public static AdminRun svc_arun;
    public static AttachmentService svc_attach;
    public static NodeRenderService svc_render;
    public static NodeEditService svc_edit;
    public static FriendService svc_friend;
    public static Validator svc_validator;
    public static EmailService svc_email;
    public static PushService svc_push;
    public static GraphNodesService svc_graphNodes;
    public static EnglishDictionary svc_english;
    public static AsyncExec svc_async;
    public static DatabaseService svc_pgSvc;
    public static PostgresTransactional svc_pgTrans;
    public static MongoTransactional svc_mongoTrans;
    public static PaymentService svc_pgPayments;
    public static NodeSearchService svc_search;
    public static CallProcessor svc_callProc;
    public static NodeMoveService svc_move;
    public static ImportService svc_import;
    public static FinancialReport svc_financialReport;
    public static SystemService svc_system;
    public static RSSFeedService svc_rssFeed;
    public static OpenGraphService svc_openGraph;
    public static FileUtils svc_fileUtil;
    public static MimeUtil svc_mimeUtil;
    public static MongoAppConfig svc_mac;
    public static BookmarkType svc_bookmarkType;
    public static CalendarType svc_calendarType;
    public static AIAnswerType svc_aiAnswerType;
    public static FriendType svc_friendType;
    public static RssFeedType svc_rssType;
    public static MongoTemplateWrapper svc_ops;
    public static MongoRepository svc_mongoRepo;
    public static SimpleMongoClientDatabaseFactory svc_mdbf;
    public static CryptoService svc_crypto;
    public static SchemaOrgService svc_schema;
    public static AIService svc_ai;
    public static TransferService svc_xfer;
    public static PublicationService svc_publication;

    public static boolean initComplete = false;
    public static final Object initLock = new Object();
    public static GracefulShutdown gracefulShutdown;

    public ServiceBase() {}

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        // log.debug("handleContextRefresh: " + getClass().getName());
        context = event.getApplicationContext();
        ServiceBase.initBeans(context);
    }

    // This is similar to @PostConstruct, but guaranteed to be called AFTER all beans. Intended to be
    // optionally overridden
    public void postConstruct() {}

    /*
     * Note: All` @EventListener public void handleContextRefresh(ContextRefreshedEvent event)` should
     * call this method immediately before doing anything else, and this is fine because nothing happens
     * on subsequent runs. The reason is because we cannot predict WHICH @EventListener will be called
     * first, so we must allow any sequence that Spring happens to run with, in a non-deterministic way.
     */
    public static void initBeans(ApplicationContext ctx) {
        synchronized (initLock) {
            if (initComplete) {
                return;
            }
            log.debug("Setting ServiceBase Proxy Instances...");
            svc_testUtil = getBean(ctx, TestUtil.class);
            svc_prop = getBean(ctx, AppProp.class);
            svc_userFeed = getBean(ctx, UserFeedService.class);
            svc_convert = getBean(ctx, Convert.class);
            svc_typeMgr = getBean(ctx, TypePluginMgr.class);
            svc_mongoCreate = getBean(ctx, MongoCreate.class);
            svc_mongoRead = getBean(ctx, MongoRead.class);
            svc_mongoUpdate = getBean(ctx, MongoUpdate.class);
            svc_mongoDelete = getBean(ctx, MongoDelete.class);
            svc_auth = getBean(ctx, MongoAuth.class);
            svc_mongoUtil = getBean(ctx, MongoUtil.class);
            svc_snUtil = getBean(ctx, SubNodeUtil.class);
            svc_aiUtil = getBean(ctx, AIUtil.class);
            svc_acl = getBean(ctx, AclService.class);
            svc_user = getBean(ctx, UserManagerService.class);
            svc_redis = getBean(ctx, RedisService.class);
            svc_arun = getBean(ctx, AdminRun.class);
            svc_attach = getBean(ctx, AttachmentService.class);
            svc_render = getBean(ctx, NodeRenderService.class);
            svc_edit = getBean(ctx, NodeEditService.class);
            svc_friend = getBean(ctx, FriendService.class);
            svc_validator = getBean(ctx, Validator.class);
            svc_email = getBean(ctx, EmailService.class);
            svc_push = getBean(ctx, PushService.class);
            svc_graphNodes = getBean(ctx, GraphNodesService.class);
            svc_english = getBean(ctx, EnglishDictionary.class);
            svc_async = getBean(ctx, AsyncExec.class);
            svc_pgSvc = getBean(ctx, DatabaseService.class);
            svc_pgTrans = getBean(ctx, PostgresTransactional.class);
            svc_mongoTrans = getBean(ctx, MongoTransactional.class);
            svc_pgPayments = getBean(ctx, PaymentService.class);
            svc_search = getBean(ctx, NodeSearchService.class);
            svc_callProc = getBean(ctx, CallProcessor.class);
            svc_move = getBean(ctx, NodeMoveService.class);
            svc_import = getBean(ctx, ImportService.class);
            svc_financialReport = getBean(ctx, FinancialReport.class);
            svc_system = getBean(ctx, SystemService.class);
            svc_rssFeed = getBean(ctx, RSSFeedService.class);
            svc_openGraph = getBean(ctx, OpenGraphService.class);
            svc_fileUtil = getBean(ctx, FileUtils.class);
            svc_mimeUtil = getBean(ctx, MimeUtil.class);
            svc_bookmarkType = getBean(ctx, BookmarkType.class);
            svc_calendarType = getBean(ctx, CalendarType.class);
            svc_aiAnswerType = getBean(ctx, AIAnswerType.class);
            svc_friendType = getBean(ctx, FriendType.class);
            svc_rssType = getBean(ctx, RssFeedType.class);
            svc_mongoRepo = getBean(ctx, MongoRepository.class);
            svc_tranRepo = getBean(ctx, TranRepository.class);
            svc_userRepo = getBean(ctx, UserRepository.class);
            svc_ops = getBean(ctx, MongoTemplateWrapper.class);
            svc_pub = getBean(ctx, EventPublisher.class);
            svc_crypto = getBean(ctx, CryptoService.class);
            svc_schema = getBean(ctx, SchemaOrgService.class);
            svc_ai = getBean(ctx, AIService.class);
            svc_xfer = getBean(ctx, TransferService.class);
            svc_publication = getBean(ctx, PublicationService.class);
            gracefulShutdown = getBean(ctx, GracefulShutdown.class);

            // We improve over Spring by only calling PostConstructs once all
            // beans are initialized
            for (Runnable lambda : postConstructs) {
                lambda.run();
            }
            initComplete = true;
        }
    }

    static <T> T getBean(ApplicationContext ctx, Class<T> requiredType) throws BeansException {
        T ret = ctx.getBean(requiredType);
        if (ret instanceof ServiceBase _ret) {
            ServiceBase.postConstructs.add(_ret::postConstruct);
        }
        return ret;
    }
}
