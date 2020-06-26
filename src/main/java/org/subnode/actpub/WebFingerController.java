package org.subnode.actpub;

import java.util.LinkedList;
import java.util.List;

import org.subnode.actpub.model.WebFingerLink;
import org.subnode.config.ConstantsProvider;
import org.subnode.response.WebFingerAcctResourceResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
/**
 * This class performs the WebFinger functionality as specified here:
 * 
 * https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/
 * 
 */
@Controller
@CrossOrigin
public class WebFingerController {
	private static final Logger log = LoggerFactory.getLogger(WebFingerController.class);

	public static final String API_PATH = "/.well-known";

	@Autowired
	private ConstantsProvider constProvider;

	//Example: /.well-known/webfinger?resource=acct:bob@my-example.com. 
	@RequestMapping(value = API_PATH + "/webfinger", method = RequestMethod.GET)
	public @ResponseBody Object webFinger(//
			@RequestParam(value = "resource", required = true) String resource) {
		WebFingerAcctResourceResponse res = new WebFingerAcctResourceResponse();
		
		if (resource.startsWith("acct:")) {
			String user = resource.substring(5);
			//todo-0: need to make this pull from properties file.
			if ("wclayf@quanta.wiki".equals(user)) {
				res.setSubject(resource);
				
				List<WebFingerLink> links = new LinkedList<WebFingerLink>();
				WebFingerLink link = new WebFingerLink();
				link.setRel("self");
				link.setType("application/activity+json");

				String href =  constProvider.getHostAndPort() + ActivityPubController.API_PATH + "/actor";
				link.setHref(href);
				links.add(link);
				res.setLinks(links);
			}
		}

		return res;
	}
}
