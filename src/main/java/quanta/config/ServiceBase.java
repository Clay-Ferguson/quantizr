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
import quanta.mongo.MongoTemplateWrapper;
import quanta.mongo.MongoUpdate;
import quanta.mongo.MongoUtil;
import quanta.postgres.DatabaseService;
import quanta.postgres.PaymentService;
import quanta.postgres.repo.TranRepository;
import quanta.postgres.repo.UserRepository;
import quanta.service.AclService;
import quanta.service.AttachmentService;
import quanta.service.CryptoService;
import quanta.service.FinancialReport;
import quanta.service.FriendService;
import quanta.service.GraphNodesService;
import quanta.service.OpenGraphService;
import quanta.service.PushService;
import quanta.service.RSSFeedService;
import quanta.service.RedisService;
import quanta.service.SchemaOrgService;
import quanta.service.SystemService;
import quanta.service.TransferService;
import quanta.service.UserFeedService;
import quanta.service.UserManagerService;
import quanta.service.ai.GeminiAiService;
import quanta.service.ai.HuggingFaceService;
import quanta.service.ai.OobaAiService;
import quanta.service.ai.OpenAiService;
import quanta.service.ai.PplxAiService;
import quanta.service.ai.AnthAiService;
import quanta.service.imports.ImportService;
import quanta.service.node.NodeEditService;
import quanta.service.node.NodeMoveService;
import quanta.service.node.NodeRenderService;
import quanta.service.node.NodeSearchService;
import quanta.test.TestUtil;
import quanta.types.OpenAIAnswerType;
import quanta.types.PplxAIAnswerType;
import quanta.types.AnthAIAnswerType;
import quanta.types.BookmarkType;
import quanta.types.CalendarType;
import quanta.types.FriendType;
import quanta.types.GeminiAIAnswerType;
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
 *
 * Another reason this class is good is that it gives every object a way to call methods on itself
 * AND have AOP methods (like @PerfMon-driven ones) be capable of working. If you don't call a
 * method thru it's proxy object then Spring AOP does NOT work, and this is a problem because in
 * Spring normally when you call a method in the same object you're calling from Spring WILL NOT go
 * thru the proxy. As an example if we called a method in UserFeedService from inside that same
 * service, then unless we call like this: userFeed.myMethod(), then the proxy-based AOP stuff will
 * not execute, because it won't be called thru a proxy.
 */
public class ServiceBase {
    private static Logger log = LoggerFactory.getLogger(ServiceBase.class);

    static List<Runnable> postConstructs = new ArrayList<>();
    public static ApplicationContext context;

    public static TestUtil testUtil;
    public static TranRepository tranRepository;
    public static UserRepository userRepository;
    public static EventPublisher publisher;
    public static AppProp prop;
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
    public static AIUtil aiUtil;
    public static AclService acl;
    public static UserManagerService user;
    public static RedisService redis;
    public static AdminRun arun;
    public static AttachmentService attach;
    public static NodeRenderService render;
    public static NodeEditService edit;
    public static FriendService friend;
    public static Validator validator;
    public static OutboxMgr outbox;
    public static EmailSenderDaemon notify;
    public static EmailSender mail;
    public static PushService push;
    public static GraphNodesService graphNodes;
    public static EnglishDictionary english;
    public static AsyncExec exec;
    public static DatabaseService pgSvc;
    public static PaymentService pgPayments;
    public static NodeSearchService search;
    public static CallProcessor callProc;
    public static NodeMoveService move;
    public static ImportService importService;
    public static FinancialReport financialReport;
    public static SystemService system;
    public static RSSFeedService rssFeed;
    public static OpenGraphService openGraph;
    public static FileUtils fileUtil;
    public static MimeUtil mimeUtil;
    public static MongoAppConfig mac;
    public static BookmarkType bookmarkType;
    public static CalendarType calendarType;
    public static OpenAIAnswerType aiAnswerType;
    public static GeminiAIAnswerType geminiAiAnswerType;
    public static PplxAIAnswerType pplxAiAnswerType;
    public static AnthAIAnswerType anthaiAnswerType;
    public static FriendType friendType;
    public static RssFeedType rssType;
    public static MongoTemplateWrapper opsw;
    public static MongoRepository mongoRepo;
    public static SimpleMongoClientDatabaseFactory mdbf;
    public static CryptoService crypto;
    public static SchemaOrgService schema;
    public static OpenAiService oai;
    public static PplxAiService pplxai;
    public static AnthAiService anthai;
    public static GeminiAiService geminiai;
    public static HuggingFaceService huggingFace;
    public static OobaAiService oobaAi;
    public static TransferService transfer;
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

    // Note: All` @EventListener public void handleContextRefresh(ContextRefreshedEvent event)` should
    // call this method immediately before doing anything else, and this is fine because nothing
    // happens on subsequent runs. The reason is because we cannot predict WHICH @EventListener will be
    // called first, so we must allow any sequence that Spring happens to run with, in a
    // non-deterministic way.
    public static void initBeans(ApplicationContext ctx) {
        synchronized (initLock) {
            if (initComplete) {
                return;
            }
            log.debug("Setting ServiceBase Proxy Instances...");
            testUtil = getBean(ctx, TestUtil.class);
            prop = getBean(ctx, AppProp.class);
            userFeed = getBean(ctx, UserFeedService.class);
            convert = getBean(ctx, Convert.class);
            typePluginMgr = getBean(ctx, TypePluginMgr.class);
            create = getBean(ctx, MongoCreate.class);
            read = getBean(ctx, MongoRead.class);
            update = getBean(ctx, MongoUpdate.class);
            delete = getBean(ctx, MongoDelete.class);
            auth = getBean(ctx, MongoAuth.class);
            mongoUtil = getBean(ctx, MongoUtil.class);
            snUtil = getBean(ctx, SubNodeUtil.class);
            aiUtil = getBean(ctx, AIUtil.class);
            acl = getBean(ctx, AclService.class);
            user = getBean(ctx, UserManagerService.class);
            redis = getBean(ctx, RedisService.class);
            arun = getBean(ctx, AdminRun.class);
            attach = getBean(ctx, AttachmentService.class);
            render = getBean(ctx, NodeRenderService.class);
            edit = getBean(ctx, NodeEditService.class);
            friend = getBean(ctx, FriendService.class);
            validator = getBean(ctx, Validator.class);
            outbox = getBean(ctx, OutboxMgr.class);
            notify = getBean(ctx, EmailSenderDaemon.class);
            mail = getBean(ctx, EmailSender.class);
            push = getBean(ctx, PushService.class);
            graphNodes = getBean(ctx, GraphNodesService.class);
            english = getBean(ctx, EnglishDictionary.class);
            exec = getBean(ctx, AsyncExec.class);
            pgSvc = getBean(ctx, DatabaseService.class);
            pgPayments = getBean(ctx, PaymentService.class);
            search = getBean(ctx, NodeSearchService.class);
            callProc = getBean(ctx, CallProcessor.class);
            move = getBean(ctx, NodeMoveService.class);
            importService = getBean(ctx, ImportService.class);
            financialReport = getBean(ctx, FinancialReport.class);
            system = getBean(ctx, SystemService.class);
            rssFeed = getBean(ctx, RSSFeedService.class);
            openGraph = getBean(ctx, OpenGraphService.class);
            fileUtil = getBean(ctx, FileUtils.class);
            mimeUtil = getBean(ctx, MimeUtil.class);
            bookmarkType = getBean(ctx, BookmarkType.class);
            calendarType = getBean(ctx, CalendarType.class);
            aiAnswerType = getBean(ctx, OpenAIAnswerType.class);
            geminiAiAnswerType = getBean(ctx, GeminiAIAnswerType.class);
            pplxAiAnswerType = getBean(ctx, PplxAIAnswerType.class);
            anthaiAnswerType = getBean(ctx, AnthAIAnswerType.class);
            friendType = getBean(ctx, FriendType.class);
            rssType = getBean(ctx, RssFeedType.class);
            mongoRepo = getBean(ctx, MongoRepository.class);
            tranRepository = getBean(ctx, TranRepository.class);
            userRepository = getBean(ctx, UserRepository.class);
            opsw = getBean(ctx, MongoTemplateWrapper.class);
            publisher = getBean(ctx, EventPublisher.class);
            crypto = getBean(ctx, CryptoService.class);
            schema = getBean(ctx, SchemaOrgService.class);
            oai = getBean(ctx, OpenAiService.class);
            pplxai = getBean(ctx, PplxAiService.class);
            anthai = getBean(ctx, AnthAiService.class);
            geminiai = getBean(ctx, GeminiAiService.class);
            huggingFace = getBean(ctx, HuggingFaceService.class);
            oobaAi = getBean(ctx, OobaAiService.class);
            transfer = getBean(ctx, TransferService.class);
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
        // log.debug("getBean: " + requiredType.getSimpleName());
        T ret = ctx.getBean(requiredType);
        if (ret instanceof ServiceBase _ret) {
            ServiceBase.postConstructs.add(_ret::postConstruct);
        }
        return ret;
    }
}
