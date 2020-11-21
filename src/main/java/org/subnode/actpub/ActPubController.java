package org.subnode.actpub;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.subnode.service.ActPubService;

@Controller
@CrossOrigin
public class ActPubController {
	private static final Logger log = LoggerFactory.getLogger(ActPubController.class);

	private static final String CONTENT_TYPE_JSON_LD = "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"";

	@Autowired
	private ActPubService actPubService;

	@RequestMapping(value = "/.well-known/webfinger", method = RequestMethod.GET, produces = "application/jrd+json")
	public @ResponseBody Object webFinger(//
			@RequestParam(value = "resource", required = true) String resource) {
		Object ret = actPubService.generateWebFingerResponse(resource);
		if (ret!=null) return ret;
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	/* This is the Actor URL, and is what we send back in the webfinger */
	@RequestMapping(value = "/ap/u/{userName}", method = RequestMethod.GET, produces = CONTENT_TYPE_JSON_LD)
	public @ResponseBody Object actor(@PathVariable(value = "userName", required = true) String userName) {
		Object ret = actPubService.getActor(userName);
		if (ret!=null) return ret;
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	// The code below is older work that was just getting started.

	// // Example outbox reply
	// // {
	// // "@context": "https://www.w3.org/ns/activitystreams",
	// // "id": "https://fosstodon.org/users/tychi/outbox",
	// // "type": "OrderedCollection",
	// // "totalItems": 344,
	// // "first": "https://fosstodon.org/users/tychi/outbox?page=true",
	// // "last": "https://fosstodon.org/users/tychi/outbox?min_id=0\u0026page=true"
	// // }
	// //
	// @RequestMapping(value = "/ap/outbox/{userName}", method = RequestMethod.GET,
	// produces = CONTENT_TYPE_JSON_LD)
	// public @ResponseBody Object outbox( //
	// @PathVariable(value = "userName", required = true) String userName, //
	// @RequestParam(value = "page", required = false) String page //
	// // @RequestParam(value = "min_id", required = false) String minId
	// ) {
	// Object ret = actPubService.getOutbox(userName, page);
	// if (ret != null) {
	// return ret;
	// }
	// return new ResponseEntity(HttpStatus.NOT_FOUND);
	// }

	// @RequestMapping(value = "/ap/followers/{userName}", method =
	// RequestMethod.GET, produces = CONTENT_TYPE_JSON_LD)
	// public @ResponseBody Object followers(@PathVariable(value = "userName",
	// required = true) String userName) {

	// // String host = "https://" + appProp.getMetaHost();
	// // resp.header("Access-Control-Allow-Origin", "*");
	// try {
	// SubNode userNode = read.getUserNodeByUserName(null, userName);
	// if (userNode != null) {
	// ActPubFollowers followers = new ActPubFollowers();
	// followers.setSummary("Clay's Followers");

	// List<ActPubFollower> items = new LinkedList<ActPubFollower>();

	// // return empty list for now
	// // for (int i = 0; i < 5; i++) {
	// // ActPubOutboxItem item = new ActPubOutboxItem();
	// // item.setType("Node");
	// // item.setName("Outbox item " + i);
	// // items.add(item);
	// // }

	// followers.setTotalItems(items.size());
	// followers.setItems(items);

	// log.debug("Reply with Followers: " + XString.prettyPrint(followers));
	// return followers;
	// }
	// } catch (Exception e) {
	// // todo-0
	// }
	// return new ResponseEntity(HttpStatus.NOT_FOUND);
	// }
}
