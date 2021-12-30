package quanta.mongo;

import static org.bson.codecs.configuration.CodecRegistries.fromProviders;
import static org.bson.codecs.configuration.CodecRegistries.fromRegistries;
import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.MongoCredential;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSBuckets;
import org.bson.codecs.configuration.CodecRegistry;
import org.bson.codecs.pojo.PojoCodecProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.WriteResultChecking;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import quanta.config.AppProp;
import quanta.config.ServiceBase;
import quanta.exception.base.RuntimeEx;
import quanta.util.ExUtil;

// Ref: http://mongodb.github.io/mongo-java-driver/3.7/driver/getting-started/quick-start-pojo/

/**
 * Spring configuration bean responsible for initializing and setting up MongoDD connection.
 */
@Configuration
@EnableMongoRepositories(basePackages = "quanta.mongo")
// see also: ServerMonitorListener to detect heartbeats, etc.
public class MongoAppConfig extends AbstractMongoClientConfiguration {
	private static final Logger log = LoggerFactory.getLogger(MongoAppConfig.class);

	public static final String databaseName = "database";

	private MongoTemplate ops;
	private MongoClient mongoClient;
	private GridFSBucket gridFsBucket;
	private GridFsTemplate grid;
	private SimpleMongoClientDatabaseFactory factory;
	private MappingMongoConverter converter;

	/**
	 * we have this so we can set it to true and know that MongoDb failed and gracefully run in case we
	 * need to run for debugging purposes.
	 */
	public static boolean connectionFailed = false;

	@Autowired
	private AppProp appProp;

	@EventListener
	public void handleContextRefresh(ContextRefreshedEvent event) {
		log.debug("MongoAppConfig. Context refreshed.");
	}

	@Override
	@Bean
	public MongoDatabaseFactory mongoDbFactory() {
		log.debug("create mongoDbFactory");
		if (connectionFailed)
			return null;

		if (no(factory)) {
			try {
				MongoClient mc = mongoClient();
				if (ok(mc)) {
					factory = new SimpleMongoClientDatabaseFactory(mc, databaseName);
				} else {
					return null;
				}
			} catch (Exception e) {
				connectionFailed = true;
				log.debug("Unable to connect to MongoDb");
				return null;
			}
		}
		return factory;
	}

	@Bean
	public GridFSBucket gridFsBucket() {
		log.debug("create gridFdBucket");
		if (connectionFailed)
			return null;

		if (no(gridFsBucket)) {
			MongoDatabaseFactory mdbf = mongoDbFactory();
			if (ok(mdbf)) {
				MongoDatabase db = mdbf.getMongoDatabase();
				gridFsBucket = GridFSBuckets.create(db);
			}
		}
		return gridFsBucket;
	}

	// DO NOT REMOVE THIS. IT IS REQUIRED FOR THIS BEAN TO WORK.
	@Bean
	public MongoEventListener userCascadingMongoEventListener() {
		return new MongoEventListener();
	}

	@Override
	public MongoClient mongoClient() {
		log.debug("create mongoClient");
		if (connectionFailed)
			return null;

		if (no(mongoClient)) {
			MongoCredential credential = null;

			if (appProp.getMongoSecurity()) {
				log.debug("MongoSecurity enabled.");
				String password = appProp.getMongoAdminPassword();
				credential = MongoCredential.createCredential("root", "admin", password.toCharArray());
			} else {
				log.debug("MongoSecurity disabled.");
			}

			try {
				String mongoHost = appProp.getMongoDbHost();
				Integer mongoPort = appProp.getMongoDbPort();

				if (no(mongoHost)) {
					throw new RuntimeEx("mongodb.host property is missing");
				}

				if (no(mongoPort)) {
					throw new RuntimeEx("mongodb.port property is missing");
				}

				String uri = "mongodb://" + mongoHost + ":" + String.valueOf(mongoPort);
				log.info("Connecting to MongoDb: " + uri);

				/*
				 * This codec registroy is what allows us to store objects that contain other POJOS, like for
				 * example the way we're storing AccessControl objects in a map inside SubNode
				 */
				CodecRegistry pojoCodecRegistry = fromRegistries(MongoClientSettings.getDefaultCodecRegistry(),
						fromProviders(PojoCodecProvider.builder().automatic(true).build()));

				MongoClientSettings.Builder builder = MongoClientSettings.builder();
				if (ok(credential)) {
					builder = builder.credential(credential);
				}
				builder = builder.applyConnectionString(new ConnectionString(uri)); //
				builder = builder.codecRegistry(pojoCodecRegistry); //
				MongoClientSettings settings = builder.build();
				mongoClient = MongoClients.create(settings);

				if (ok(mongoClient)) {
					if (ok(credential)) {
						for (String db : mongoClient.listDatabaseNames()) {
							log.debug("MONGO DB NAME: " + db);
						}
					}

					log.info("Connected to Mongo OK.");
				} else {
					connectionFailed = true;
					log.error("Unable to connect MongoClient");
				}

			} catch (Exception e) {
				connectionFailed = true;
				ExUtil.error(log, "********** Unable to connect to MongoDb. **********", e);
				throw e;
			}
		}
		return mongoClient;
	}

	/**
	 * MongoTemplate is thread-safe and can be reused everywhere in all threads.
	 */
	@Override
	@Bean
	public MongoTemplate mongoTemplate(MongoDatabaseFactory databaseFactory, MappingMongoConverter converter) {
		if (no(ops)) {
			// todo-0: slight hack here. Is there a better way to just 'get' the converter when needed
			this.converter = converter;
			log.debug("create mongoTemplate");
			ops = super.mongoTemplate(databaseFactory, converter);
			ops.setWriteResultChecking(WriteResultChecking.EXCEPTION);
			ServiceBase.ops = ops;
		}
		return ops;
	}

	@Bean
	public GridFsTemplate gridFsTemplate() throws Exception {
		log.debug("create gridFsTemplate");
		if (connectionFailed)
			return null;

		if (no(grid)) {
			MongoDatabaseFactory mdbf = mongoDbFactory();
			if (ok(mdbf)) {
				if (no(converter)) {
					log.debug("no converter is ready yet in gridFsTemplate");
				}
				grid = new GridFsTemplate(mdbf, converter);
			} else {
				return null;
			}
		}
		return grid;
	}

	@Override
	protected String getDatabaseName() {
		return databaseName;
	}

	@Override
	protected String getMappingBasePackage() {
		return "quanta.mongo";
	}
}
