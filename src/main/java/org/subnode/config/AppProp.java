package org.subnode.config;

import java.io.File;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.subnode.util.ExUtil;
import org.subnode.util.StreamUtil;
import org.subnode.util.XString;

/**
 * Primary class for accessing application properties.
 * <p>
 * NOTE: We could use EnvironmentAware but under normal circumstances apps can just Autowire the
 * Env, so that's what we do.
 */
@Component
public class AppProp /* implements EnvironmentAware */ {
	private static final Logger log = LoggerFactory.getLogger(AppProp.class);

	@Autowired
	private Environment env;

	private String protocolHostAndPort = null;

	public static final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
	HashMap<String, Object> configMap = null;

	public HashMap<String, Object> getConfig() {
		if (configMap != null) {
			return configMap;
		}

		synchronized (yamlMapper) {
			try {
				HashMap<String, Object> configMapInternal = readYamlInternal("config-text.yaml");
				HashMap<String, Object> configMapExternal = readYamlExternal("config-text.yaml");

				/* For every key in internal set, override with the external val if found */
				for (String key : configMapInternal.keySet()) {
					Object val = configMapExternal.get(key);
					if (val != null) {
						configMapInternal.put(key, val);
					}
				}

				configMap = configMapInternal;
			} catch (Exception e) {
				ExUtil.error(log, "failed to load help-text.yaml", e);
			}

			if (configMap == null) {
				configMap = new HashMap<>();
			}
			return configMap;
		}
	}

	/* Gets config text from external file if found, and it not gets property from internal */
	public String getConfigText(String prop) {
		return (String) getConfig().get(prop);
	}

	/*
	 * Reads a yaml file into a map from internal file at "classname:[fileName]
	 */
	public static HashMap<String, Object> readYamlInternal(String fileName) {
		synchronized (yamlMapper) {
			InputStream is = null;
			HashMap<String, Object> map = null;

			try {
				log.debug("Loading config from internal classpath: " + fileName);
				Resource resource = SpringContextUtil.getApplicationContext().getResource("classpath:" + fileName);
				is = resource.getInputStream();

				map = yamlMapper.readValue(is, new TypeReference<HashMap<String, Object>>() {
				});

				if (map == null) {
					map = new HashMap<>();
				}

			} catch (Exception e) {
				ExUtil.error(log, "failed to load help-text.yaml", e);
			} finally {
				StreamUtil.close(is);
			}
			return map;
		}
	}

	public static HashMap<String, Object> readYamlExternal(String fileName) {
		synchronized (yamlMapper) {
			HashMap<String, Object> map = null;
			try {
				File file = new File("/config/" + fileName);

				// if an external config file is found use it.
				if (file.isFile()) {
					log.debug("Loading config from file system: " + fileName);
					map = yamlMapper.readValue(file, new TypeReference<HashMap<String, Object>>() {
					});
				}

				if (map == null) {
					map = new HashMap<>();
				}
			} catch (Exception e) {
				ExUtil.error(log, "failed to load help-text.yaml", e);
			}
			return map;
		}
	}

	public String getHostAndPort() {
		return getHttpProtocol() + "://" + getMetaHost() + ":" + getServerPort();
	}

	public String getLuceneDir() {
		return "/subnode-lucene"; // todo-2: get this from prop
	}

	public String getStringProp(String propName) {
		return env.getProperty(propName);
	}

	public String getMetaHost() {
		return env.getProperty("metaHost");
	}

	public String getHttpProtocol() {
		return env.getProperty("httpProtocol");
	}

	public String getProtocolHostAndPort() {
		if (protocolHostAndPort != null)
			return protocolHostAndPort;

		protocolHostAndPort = getHttpProtocol() + "://" + getMetaHost();

		// If port is needed (not default) then add it.
		if (!(getHttpProtocol().equals("https") && getServerPort().equals("443"))
				&& !(getHttpProtocol().equals("http") && getServerPort().equals("80"))) {
			protocolHostAndPort += ":" + getServerPort();
		}

		return protocolHostAndPort;
	}

	public List<String> getRunTests() {
		List<String> ret = null;
		String runTests = env.getProperty("runTests");
		if (!StringUtils.isEmpty(runTests)) {
			ret = XString.tokenize(runTests, ",", true);
		} else {
			ret = new LinkedList<>();
		}
		return ret;
	}

	public String getServerPort() {
		return env.getProperty("server.port");
	}

	public String getProfileName() {
		return env.getProperty("profileName");
	}

	public String getRssAggregatePreCacheNodeId() {
		return env.getProperty("rssAggregatePreCacheNodeId");
	}

	public String getIPFSApiHostAndPort() {
		return env.getProperty("ipfs.host") + ":" + env.getProperty("ipfs.apiPort");
	}

	public String getIPFSGatewayHostAndPort() {
		return env.getProperty("ipfs.host") + ":" + env.getProperty("ipfs.gatewayPort");
	}

	public String getMongoDbHost() {
		return env.getProperty("mongodb.host");
	}

	public Integer getMongoDbPort() {
		return Integer.parseInt(env.getProperty("mongodb.port"));
	}

	public String getAdminDataFolder() {
		return getPathProperty("adminDataFolder");
	}

	public String getRsaKeyFolder() {
		return getPathProperty("rsaKeyFolder");
	}

	public String getTestUserAccounts() {
		return env.getProperty("testUserAccounts");
	}

	public String getMongoAdminUserName() {
		return env.getProperty("mongoAdminUserName");
	}

	public boolean getForceIndexRebuild() {
		return "true".equals(env.getProperty("forceIndexRebuild"));
	}

	public boolean getReSaveAll() {
		return "true".equals(env.getProperty("reSaveAll"));
	}

	/* Should be set to true if mongo security is turned on requiring credentials */
	public boolean getMongoSecurity() {
		return "true".equals(env.getProperty("mongoSecurity"));
	}

	public String getMongoAdminPassword() {
		return env.getProperty("mongoAdminPassword");
	}

	public String getUserLandingPageNode() {
		return env.getProperty("anonUserLandingPageNode");
	}

	public String getMailHost() {
		return env.getProperty("mail.host");
	}

	public String getMailFrom() {
		return env.getProperty("mail.from");
	}

	public String getMailPort() {
		return env.getProperty("mail.port");
	}

	public String getMailUser() {
		return env.getProperty("mail.user");
	}

	public String getMailPassword() {
		return env.getProperty("mail.password");
	}

	public String getAesKey() {
		return env.getProperty("aeskey");
	}

	public boolean isAllowFileSystemSearch() {
		return getBooleanProp("allowFileSystemSearch");
	}

	/* considers property 'true' if it starts with letter 't', 'y' (yes), or 1 */
	public boolean getBooleanProp(String propName) {
		String val = env.getProperty(propName);
		if (val == null)
			return false;
		val = val.toLowerCase();
		return val.startsWith("t") || val.startsWith("y") || val.startsWith("1");
	}

	public String getProp(String propName) {
		return env.getProperty(propName);
	}

	public String getPathProperty(String propName) {
		return translateDirs(env.getProperty(propName));
	}

	public String translateDirs(String folder) {
		if (folder == null)
			return folder;
		String userDir = System.getProperty("user.dir");
		return folder.replace("{user.dir}", userDir);
	}
}
