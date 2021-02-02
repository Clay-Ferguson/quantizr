package org.subnode.config;

import java.util.LinkedList;
import java.util.List;

import org.subnode.util.XString;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

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

	public String getMongoDbName() {
		return env.getProperty("mongodb.name");
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

	public boolean getMongoTest() {
		return "true".equals(env.getProperty("mongoTest"));
	}

	/* Should be set to true if mongo security is turned on requiring credentials */
	public boolean getMongoSecurity() {
		return "true".equals(env.getProperty("mongoSecurity"));
	}

	public String getReCaptcha3SiteKey() {
		return env.getProperty("reCaptcha3SiteKey");
	}

	public String getReCaptcha3SecretKey() {
		return env.getProperty("reCaptcha3SecretKey");
	}

	public String getMongoAdminPassword() {
		return env.getProperty("mongoAdminPassword");
	}

	public String getUserLandingPageNode() {
		return env.getProperty("anonUserLandingPageNode");
	}

	public String getBrandingMetaContent() {
		return env.getProperty("brandingMetaContent");
	}

	public String getBrandingAppName() {
		return env.getProperty("brandingAppName");
	}

	public String getIntroSubtitle() {
		return env.getProperty("introSubtitle");
	}

	public String getIntro1() {
		return env.getProperty("intro1");
	}

	public String getIntro2() {
		return env.getProperty("intro2");
	}

	public String getResourcesBaseFolder() {
		return env.getProperty("resourcesBaseFolder");
	}

	public String getSolrSearchHost() {
		return env.getProperty("solr.search.host");
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
