package org.subnode.actpub;

import java.util.LinkedList;
import java.util.List;

import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.subnode.actpub.model.ActPubActor;
import org.subnode.actpub.model.ActPubCreate;
import org.subnode.actpub.model.ActPubPublicKey;
import org.subnode.config.AppProp;
import org.subnode.config.ConstantsProvider;
import org.subnode.response.GetPublicServerInfoResponse;
import org.subnode.response.base.ResponseBase;
import org.subnode.util.FileUtils;
import org.subnode.util.XString;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * This class will eventually be an ActivityPub Client/Server, folling the
 * instructions here:
 * 
 * https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/
 * 
 * Progress so far: not yet tested against Mastodon (the goal) and not yet fully
 * implemented.
 */
@Controller
@CrossOrigin
public class ActivityPubController {
	private static final Logger log = LoggerFactory.getLogger(ActivityPubController.class);

	public static final String API_PATH = "/actpub";

	@Autowired
	private ConstantsProvider constProvider;

	@Autowired
	AppProp appProp;

	@RequestMapping(value = API_PATH + "/publicServerInfo", method = RequestMethod.GET)
	public @ResponseBody ResponseBase getPublicServerInfo(HttpSession session) {
		GetPublicServerInfoResponse res = new GetPublicServerInfoResponse();
		res.setServerInfo("Welcome to ActivityPub fellow nerds.");
		res.setSuccess(true);
		return res;
	}

	@RequestMapping(value = API_PATH + "/actor", method = RequestMethod.GET)
	public @ResponseBody Object actor(HttpSession session) {
		log.debug("ActivityPubController/actor called");
		ActPubActor actor = new ActPubActor();

		List<String> context = new LinkedList<String>();
		context.add("https://www.w3.org/ns/activitystreams");
		context.add("https://w3id.org/security/v1");
		actor.setContext(context);

		String actorId = constProvider.getHostAndPort() + API_PATH + "/actor";

		// self referece back to this url.
		actor.setId(actorId);
		actor.setType("Person");
		actor.setPreferredUsername("wclayf");
		actor.setInbox(constProvider.getHostAndPort() + API_PATH + "/inbox");

		ActPubPublicKey publicKey = new ActPubPublicKey();
		publicKey.setId(actorId + "#main-key");
		publicKey.setOwner(actorId);

		try {
			String publicKeyFile = appProp.getRsaKeyFolder() + "/public.pem";
			String publicKeyPEM = FileUtils.readFile(publicKeyFile);
			publicKey.setPublicKeyPem(publicKeyPEM);
		} catch (Exception e) {
			throw new RuntimeException("Failed to read public.pem file.", e);
		}
		actor.setPublickey(publicKey);
		return actor;
	}

	@RequestMapping(value = API_PATH + "/inbox", method = RequestMethod.POST)
	public @ResponseBody ResponseBase inbox(@RequestBody ActPubCreate post, HttpSession session, HttpServletResponse response) {
		log.debug("ActivityPubController/inbox posted to");
		GetPublicServerInfoResponse res = new GetPublicServerInfoResponse();
		log.debug("Posted object: " + post.getClass().getName() + " JSON=\n" + XString.prettyPrint(post));
		res.setServerInfo("Welcome to ActivityPub fellow nerds.");
		res.setMessage("This is the message in the response! yay!");
		res.setSuccess(true);
		response.setStatus(HttpServletResponse.SC_OK);
		return res;
	}
}
