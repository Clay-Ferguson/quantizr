package org.subnode.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Constants Provider implementation
 * 
 * I'm using this class to inject strings into the HTML using thymeleaf and using properties file as
 * the source of the strings to inject. There is a way to inject directly from a properties file
 * into thymeleaf, but it looks more complex and less powerful than this approach. Using the
 * constantsProvider we get access to properties in a way were we can actually process them if we
 * need to before handing them to spring, because we are implementing the getters here.
 */
@Component("constantsProvider")
public class ConstantsProviderImpl implements ConstantsProvider {

	@Autowired
	private AppProp appProp;

	@Override
	public String getHostAndPort() {
		return appProp.getHttpProtocol()+"://" + appProp.getMetaHost() + ":" + appProp.getServerPort();
	}

	@Override
	public String getProfileName() {
		return appProp.getProfileName();
	}

	@Override
	public String getBrandingMetaContent() {
		return appProp.getBrandingMetaContent();
	}
}
