package org.subnode.mongo;

import org.subnode.config.AppProp;
import org.subnode.util.ExUtil;

import javax.annotation.PostConstruct;

import com.mongodb.MongoClient;
import com.mongodb.MongoClientURI;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSBuckets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDbFactory;
import org.springframework.data.mongodb.config.AbstractMongoConfiguration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoDbFactory;
import org.springframework.data.mongodb.core.WriteResultChecking;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@Configuration
@EnableMongoRepositories(basePackages = "org.subnode.mongo")
// see also: ServerMonitorListener to detect heartbeats, etc.
public class MongoAppConfig extends AbstractMongoConfiguration {
	private static final Logger log = LoggerFactory.getLogger(MongoAppConfig.class);
	public static final String databaseName = "database";
	private MongoClient mongoClient;
	private GridFSBucket gridFsBucket;

	// we have this so we can set it to true and know that MongoDb failed and
	// gracefully run
	// in case we need to run for debugging purposes.
	public static boolean connectionFailed = false;

	@Autowired
	private AppProp appProp;

	@PostConstruct
	public void postConstruct() {
		log.debug("MongoAppConfig.postConstruct: mongoAdminPassword="+appProp.getMongoAdminPassword());
	}

	@Bean
	public MongoDbFactory mongoDbFactory() {
		if (connectionFailed)
			return null;
		try {
			MongoClient mc = mongoClient();
			if (mc != null) {
				SimpleMongoDbFactory simpleMongoDbFactory = new SimpleMongoDbFactory(mc, databaseName);
				return simpleMongoDbFactory;
			} else {
				return null;
			}
		} catch (Exception e) {
			connectionFailed = true;
			log.debug("Unable to connect to MongoDb");
			return null;
		}
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
			// Set credentials
			// MongoCredential credential = MongoCredential.createCredential(mongoUser,
			// databaseName, mongoPass.toCharArray());
			// ServerAddress serverAddress = new ServerAddress(mongoHost, mongoPort);

			// mongoClient = new MongoClient(serverAddress, Arrays.asList(credential));

			try {
				String mongoHost = appProp.getMongoDbHost();
				Integer mongoPort = appProp.getMongoDbPort();

				if (mongoHost == null) {
					throw new RuntimeException("mongodb.host property is missing");
				}

				if (mongoPort == null) {
					throw new RuntimeException("mongodb.port property is missing");
				}

				String uri = "mongodb://" + mongoHost + ":" + String.valueOf(mongoPort);

				log.info("Connecting to MongoDb (" + uri + ")...");
				mongoClient = new MongoClient(new MongoClientURI(uri));
				if (mongoClient != null) {
					mongoClient.getAddress();
					log.info("Connected to Mongo OK.");
				} else {
					connectionFailed = true;
					log.error("Unable to connect MongoClient");
				}

			} catch (Exception e) {
				connectionFailed = true;
				ExUtil.error(log, "********** Unable to connect to MongoDb. **********",
						e);
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
