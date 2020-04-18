package org.subnode.mongo;

import org.subnode.config.AppProp;
import org.subnode.exception.base.RuntimeEx;
import org.subnode.util.ExUtil;

import javax.annotation.PostConstruct;

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
import org.springframework.data.mongodb.MongoDbFactory;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDbFactory;
import org.springframework.data.mongodb.core.WriteResultChecking;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import static org.bson.codecs.configuration.CodecRegistries.fromProviders;
import static org.bson.codecs.configuration.CodecRegistries.fromRegistries;

//Ref: http://mongodb.github.io/mongo-java-driver/3.7/driver/getting-started/quick-start-pojo/

@Configuration
@EnableMongoRepositories(basePackages = "org.subnode.mongo")
// see also: ServerMonitorListener to detect heartbeats, etc.
public class MongoAppConfig extends AbstractMongoClientConfiguration {
	private static final Logger log = LoggerFactory.getLogger(MongoAppConfig.class);
	public static final String databaseName = "database";
	private MongoClient mongoClient;
	private GridFSBucket gridFsBucket;
	private SimpleMongoClientDbFactory factory;

	/**
	 * we have this so we can set it to true and know that MongoDb failed and
	 * gracefully run in case we need to run for debugging purposes.
	 */
	public static boolean connectionFailed = false;

	@Autowired
	private AppProp appProp;

	@PostConstruct
	public void postConstruct() {
		log.debug("MongoAppConfig.postConstruct: mongoAdminPassword=" + appProp.getMongoAdminPassword());
	}

	@Bean
	public MongoDbFactory mongoDbFactory() {
		if (connectionFailed)
			return null;

		if (factory == null) {
			try {
				MongoClient mc = mongoClient();
				if (mc != null) {
					factory = new SimpleMongoClientDbFactory(mc, databaseName);
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
		if (connectionFailed)
			return null;

		if (gridFsBucket == null) {
			MongoDbFactory mdbf = mongoDbFactory();
			if (mdbf != null) {
				MongoDatabase db = mdbf.getDb();
				gridFsBucket = GridFSBuckets.create(db);
			}
		}
		return gridFsBucket;
	}

	@Bean
	public MongoEventListener userCascadingMongoEventListener() {
		return new MongoEventListener();
	}

	@Override
	public MongoClient mongoClient() {
		if (connectionFailed)
			return null;

		if (mongoClient == null) {
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

				if (mongoHost == null) {
					throw new RuntimeEx("mongodb.host property is missing");
				}

				if (mongoPort == null) {
					throw new RuntimeEx("mongodb.port property is missing");
				}

				String uri = "mongodb://" + mongoHost + ":" + String.valueOf(mongoPort);
				log.info("Connecting to MongoDb: " + uri);

				/*
				 * This codec registroy is what allows us to store objects that contain other
				 * POJOS, like for example the way we're storing AccessControl objects in a map
				 * inside SubNode
				 */
				CodecRegistry pojoCodecRegistry = fromRegistries(MongoClientSettings.getDefaultCodecRegistry(),
						fromProviders(PojoCodecProvider.builder().automatic(true).build()));

				MongoClientSettings.Builder builder = MongoClientSettings.builder();
				if (credential != null) {
					builder = builder.credential(credential);
				}
				builder = builder.applyConnectionString(new ConnectionString(uri)); //
				builder = builder.codecRegistry(pojoCodecRegistry); //
				MongoClientSettings settings = builder.build();
				mongoClient = MongoClients.create(settings);

				if (mongoClient != null) {

					if (credential!=null) {
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
	@Bean
	public MongoTemplate mongoTemplate() throws Exception {
		MongoDbFactory mdbf = mongoDbFactory();
		if (mdbf != null) {
			MongoTemplate mt = new MongoTemplate(mdbf);
			mt.setWriteResultChecking(WriteResultChecking.EXCEPTION);
			return mt;
		} else {
			return null;
		}
	}

	@Override
	protected String getDatabaseName() {
		return databaseName;
	}

	@Override
	protected String getMappingBasePackage() {
		return "org.subnode.mongo";
	}

	@Bean
	public GridFsTemplate gridFsTemplate() throws Exception {
		MongoDbFactory mdbf = mongoDbFactory();
		if (mdbf != null) {
			return new GridFsTemplate(mdbf, mappingMongoConverter());
		} else {
			return null;
		}
	}
}
