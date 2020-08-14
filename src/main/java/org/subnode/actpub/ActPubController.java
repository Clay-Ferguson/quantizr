package org.subnode.actpub;

import java.util.LinkedList;
import java.util.List;

import org.subnode.actpub.model.ActPubActor;
import org.subnode.actpub.model.ActPubOutbox;
import org.subnode.actpub.model.ActPubOutboxItem;
import org.subnode.actpub.model.ActPubPublicKey;
import org.subnode.actpub.model.WebFingerLink;
import org.subnode.actpub.model.WebFingerResponse;
import org.subnode.config.AppProp;
import org.subnode.model.client.NodeProp;
import org.subnode.mongo.MongoApi;
import org.subnode.mongo.model.SubNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.apache.commons.lang3.StringUtils;

/**
 * Example:
 * https://quanta.wiki/.well-known/webfinger?resource=acct:clay@quanta.wiki
 * 
 * This class performs the WebFinger functionality as specified here:
 * 
 * https://blog.joinmastodon.org/2018/06/how-to-implement-a-basic-activitypub-server/
 * 
 */
@Controller
@CrossOrigin
public class ActPubController {
	private static final Logger log = LoggerFactory.getLogger(ActPubController.class);

	private static final String CONTENT_TYPE_JSON_LD = "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";

	@Autowired
	private MongoApi api;

	@Autowired
	private AppProp appProp;

	/*
	 * WebFinger what allows us to ask a website, “Do you have a user with this
	 * username?” and receive resource links in response.
	 * 
	 * The Webfinger endpoint is always under /.well-known/webfinger, and it
	 * receives queries such as
	 * 
	 * /.well-known/webfinger?resource=acct:bob@quanta.wiki.
	 */
	@RequestMapping(value = "/.well-known/webfinger", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
	public @ResponseBody Object webFinger(//
			@RequestParam(value = "resource", required = true) String resource) {

		String host = "https://" + appProp.getMetaHost();

		// resp.header("Access-Control-Allow-Origin", "*"); //todo-0: this might be
		// what's broken???
		try {
			if (StringUtils.isNotEmpty(resource) && resource.startsWith("acct:")) {
				String[] parts = resource.substring(5).split("@", 2);
				if (parts.length == 2 && parts[1].equals(appProp.getMetaHost())) {
					String username = parts[0];

					SubNode userNode = api.getUserNodeByUserName(null, username);
					if (userNode != null) {

						WebFingerResponse wfr = new WebFingerResponse();
						wfr.setSubject("acct:" + username + "@" + appProp.getMetaHost());

						WebFingerLink wfl = new WebFingerLink();
						wfl.setRel("self");
						wfl.setType("application/activity+json");

						// The href here is required to be the link to the "actor document"
						wfl.setHref(host + "/ap/u/" + username);

						List<WebFingerLink> links = new LinkedList<WebFingerLink>();
						links.add(wfl);
						wfr.setLinks(links);
						return wfr;
					}
				}
			}
		} catch (Exception e) {
			// todo-0
		}
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	@RequestMapping(value = "/ap/u/{userName}", method = RequestMethod.GET, produces = CONTENT_TYPE_JSON_LD)
	public @ResponseBody Object actor(@PathVariable(value = "userName", required = true) String userName) {

		String host = "https://" + appProp.getMetaHost();

		// resp.header("Access-Control-Allow-Origin", "*");
		try {
			SubNode userNode = api.getUserNodeByUserName(null, userName);
			if (userNode != null) {
				ActPubActor actor = new ActPubActor();

				List<String> context = new LinkedList<String>();
				context.add("https://www.w3.org/ns/activitystreams");
				context.add("https://w3id.org/security/v1");

				actor.setContext(context);

				actor.setId(host + "/ap/u/" + userName);
				actor.setType("Person");
				actor.setPreferredUsername(userName);
				actor.setInbox(host + "/ap/inbox/" + userName);
				actor.setOutbox(host + "/ap/outbox/" + userName);
				actor.setFollowers(host + "/ap/followers/" + userName);

				ActPubPublicKey pubKey = new ActPubPublicKey();
				pubKey.setId(host + "/ap/u/" + userName + "#main-key");
				pubKey.setOwner(actor.getId());

				String pkey = "-----BEGIN PUBLIC KEY-----\n";
				pkey += userNode.getStringProp(NodeProp.CRYPTO_KEY_PUBLIC.s());
				pkey += "\n-----END PUBLIC KEY-----\n";
				pubKey.setPublicKeyPem(pkey);

				actor.setPublickey(pubKey);
				// actor.setSupportsFriendRequests(true);
				return actor;
			}
		} catch (Exception e) {
			// todo-0
		}
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	@RequestMapping(value = "/ap/outbox/{userName}", method = RequestMethod.GET, produces = CONTENT_TYPE_JSON_LD)
	public @ResponseBody Object outbox(@PathVariable(value = "userName", required = true) String userName) {

		//String host = "https://" + appProp.getMetaHost();

		// resp.header("Access-Control-Allow-Origin", "*");
		try {
			SubNode userNode = api.getUserNodeByUserName(null, userName);
			if (userNode != null) {
				ActPubOutbox outbox = new ActPubOutbox();
				outbox.setSummary("Clay's Outbox");
				outbox.setTotalItems(5);
				List<ActPubOutboxItem> items = new LinkedList<ActPubOutboxItem>();
				for (int i = 0; i < 5; i++) {
					ActPubOutboxItem item = new ActPubOutboxItem();
					item.setType("Node");
					item.setName("Outbox item " + i);
					items.add(item);
				}
				outbox.setItems(items);
				return outbox;
			}
		} catch (Exception e) {
			// todo-0
		}
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

}
