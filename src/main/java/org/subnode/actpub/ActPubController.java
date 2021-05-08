package org.subnode.actpub;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.subnode.config.AppProp;

@Controller
@CrossOrigin
public class ActPubController {
	private static final Logger log = LoggerFactory.getLogger(ActPubController.class);

	@Autowired
	private ActPubService apService;

	@Autowired
	private ActPubOutbox apOutbox;

	@Autowired
	private ActPubFollowing apFollowing;

	@Autowired
	private ActPubUtil apUtil;

	@Autowired
	private AppProp appProp;

	/**
	 * WebFinger GET
	 */
	@RequestMapping(value = ActPubConstants.PATH_WEBFINGER, method = RequestMethod.GET,
			produces = ActPubConstants.CONTENT_TYPE_JSON_JRD)
	public @ResponseBody Object webFinger(//
			@RequestParam(value = "resource", required = true) String resource) {
		Object ret = apUtil.generateWebFinger(resource);
		if (ret != null)
			return ret;
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	/**
	 * Actor GET (redirect for Mastodon)
	 *
	 * Mastodon insists on using this format for the URL which is NOT what we have in our Actor object
	 * so they are breaking the spec and we tolerate it by redirecting
	 * 
	 * simple redirect from /ap/user/[userName] to /u/[userName]/home
	 * 
	 * todo-0: is this documented in the user guide about user being able to have a node named 'home'
	 * and what it means if they do? Also need to ensure this ALWAYS works especially in the AP
	 * scenarios and when user has done nothing themselves to create a 'home' node.
	 */
	@RequestMapping(value = "/ap/user/{userName}", method = RequestMethod.GET)
	public void mastodonGetUser(//
			@PathVariable(value = "userName", required = true) String userName, //
			HttpServletRequest req, //
			HttpServletResponse response) {
		String url = appProp.getProtocolHostAndPort() + "/u/" + userName + "/home";
		try {
			log.debug("Redirecting to: " + url);
			response.sendRedirect(url);
		} catch (Exception e) {
			log.error("mastodonGetUser failed", e);
		}
	}

	/**
	 * Actor GET
	 */
	@RequestMapping(value = ActPubConstants.ACTOR_PATH + "/{userName}", method = RequestMethod.GET,
			produces = ActPubConstants.CONTENT_TYPE_JSON_ACTIVITY)
	public @ResponseBody Object actor(//
			@PathVariable(value = "userName", required = true) String userName) {
		Object ret = apService.generateActor(userName);
		if (ret != null)
			return ret;
		return new ResponseEntity(HttpStatus.NOT_FOUND);
	}

	/**
	 * Inbox POST
	 * 
	 * If no userName specified it's the system 'sharedInbox'
	 */
	@RequestMapping(value = ActPubConstants.PATH_INBOX + "/{userName}", method = RequestMethod.POST,
			produces = ActPubConstants.CONTENT_TYPE_JSON_LD)
	public @ResponseBody Object inboxPost(//
			@RequestBody APObj payload, //
			@PathVariable(value = "userName", required = false) String userName, //
			HttpServletRequest httpReq) {
		// DO NOT DELETE: If you ever want to make the payload a string just do this...
		// APObj payload = mapper.readValue(body, new TypeReference<>() {
		// });
		// log.debug("INBOX incoming payload: " + XString.prettyPrint(payload));
		ActPubService.inboxCount++;
		apService.processInboxPost(httpReq, payload);
		return new ResponseEntity(HttpStatus.OK);
	}

	/**
	 * Outbox GET
	 */
	@RequestMapping(value = ActPubConstants.PATH_OUTBOX + "/{userName}", method = RequestMethod.GET,
			produces = ActPubConstants.CONTENT_TYPE_JSON_ACTIVITY)
	public @ResponseBody Object outbox(//
			@PathVariable(value = "userName", required = true) String userName,
			@RequestParam(value = "min_id", required = false) String minId,
			@RequestParam(value = "page", required = false) String page) {
		Object ret = null;
		if ("true".equals(page)) {
			ret = apOutbox.generateOutboxPage(userName, minId);
		} else {
			/*
			 * Mastodon calls this method, but never calls back in (to generateOutboxPage above) for any pages.
			 * I'm not sure if this is something we're doing wrong or what, because I don't know enough about
			 * what Mastodon is "supposed" to do, to be able to even say if this is incorrect or not.
			 * 
			 * From analyzing other 'server to server' calls on other Mastodon instances it seems like at least
			 * the "toot count" should be showing up, but when I search a local user (non-federated) and it gets
			 * the outbox, mastodon still shows "0 toots", even though it just queried my inbox and there ARE
			 * toots and we DID return the correct number of them.
			 */
			ret = apOutbox.generateOutbox(userName);
		}
		if (ret != null) {
			// log.debug("Reply with Outbox: " + XString.prettyPrint(ret));
			return ret;
		}
		return new ResponseEntity(HttpStatus.OK);
	}

	/**
	 * Followers GET
	 */
	@RequestMapping(value = ActPubConstants.PATH_FOLLOWERS + "/{userName}", method = RequestMethod.GET,
			produces = ActPubConstants.CONTENT_TYPE_JSON_ACTIVITY)
	public @ResponseBody Object getFollowers(//
			@PathVariable(value = "userName", required = false) String userName,
			@RequestParam(value = "min_id", required = false) String minId,
			@RequestParam(value = "page", required = false) String page) {
		Object ret = null;
		if ("true".equals(page)) {
			ret = apFollowing.generateFollowersPage(userName, minId);
		} else {
			ret = apFollowing.generateFollowers(userName);
		}
		if (ret != null) {
			// log.debug("Reply with Followers: " + XString.prettyPrint(ret));
			return ret;
		}
		return new ResponseEntity(HttpStatus.OK);
	}	

	/**
	 * Following GET
	 */
	@RequestMapping(value = ActPubConstants.PATH_FOLLOWING + "/{userName}", method = RequestMethod.GET,
			produces = ActPubConstants.CONTENT_TYPE_JSON_ACTIVITY)
	public @ResponseBody Object getFollowing(//
			@PathVariable(value = "userName", required = false) String userName,
			@RequestParam(value = "min_id", required = false) String minId,
			@RequestParam(value = "page", required = false) String page) {
		Object ret = null;
		if ("true".equals(page)) {
			ret = apFollowing.generateFollowingPage(userName, minId);
		} else {
			ret = apFollowing.generateFollowing(userName);
		}
		if (ret != null) {
			// log.debug("Reply with Following: " + XString.prettyPrint(ret));
			return ret;
		}
		return new ResponseEntity(HttpStatus.OK);
	}
}
