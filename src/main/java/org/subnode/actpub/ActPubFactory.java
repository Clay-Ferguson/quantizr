package org.subnode.actpub;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

@Controller
@CrossOrigin
public class ActPubFactory {
	@Autowired
	public ActPubService apService;

	@Autowired
	public ActPubUtil apUtil;

	@Autowired
	public ActPubCache apCache;

	private static final Logger log = LoggerFactory.getLogger(ActPubFactory.class);

	/**
	 * Creates a new 'note' message
	 */
	public APObj newCreateMessageForNote(List<String> toUserNames, String fromActor, String inReplyTo, String content,
			String noteUrl, boolean privateMessage, APList attachments) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		log.debug("sending note from actor[" + fromActor + "] inReplyTo[" + inReplyTo);
		return newCreateMessage(
				newNoteObject(toUserNames, fromActor, inReplyTo, content, noteUrl, now, privateMessage, attachments), fromActor,
				toUserNames, noteUrl, now);
	}

	/**
	 * Creates a new 'note' object
	 */
	public APObj newNoteObject(List<String> toUserNames, String attributedTo, String inReplyTo, String content, String noteUrl,
			ZonedDateTime now, boolean privateMessage, APList attachments) {
		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val(ActPubConstants.CONTEXT_STREAMS) //
				.val(newContextObj()));

		ret.put("id", noteUrl);
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);
		ret.put("summary", null);
		ret.put("url", noteUrl);
		ret.put("sensitive", false);
		ret.put("content", content);

		LinkedList<String> toList = new LinkedList<>();
		LinkedList<String> ccList = new LinkedList<>();

		APList tagList = new APList();
		for (String userName : toUserNames) {
			APObj webFinger = apUtil.getWebFinger(userName);
			String actorUrl = apUtil.getActorUrlFromWebFingerObj(webFinger);

			/*
			 * For public messages Mastodon puts the "Public" target in 'to' and the mentioned users in 'cc', so
			 * we do that same thing
			 */
			if (privateMessage) {
				toList.add(actorUrl);
			} else {
				ccList.add(actorUrl);
			}
			tagList.val(new APObj() //
					.put("type", "Mention") //
					.put("href", actorUrl) //
					.put("name", "@" + userName)); // prepend character to make it like '@user@server.com'
		}
		ret.put("tag", tagList);

		if (!privateMessage) {
			toList.add(ActPubConstants.CONTEXT_STREAMS + "#Public");

			/*
			 * public posts should always cc the followers of the person doing the post (the actor pointed to by
			 * attributedTo)
			 */
			APObj actor = apCache.actorsByUrl.get(attributedTo);
			if (actor != null) {
				ccList.add(AP.str(actor, "followers"));
			}
		}

		ret.put("to", toList);

		if (ccList.size() > 0) {
			ret.put("cc", ccList);
		}

		ret.put("attachment", attachments);
		return ret;
	}

	public APObj newContextObj() {
		return new APObj() //
				/*
				 * todo-1: How does this language relate to the other format inside the @context object where we
				 * have '@language' inside and object stored on the '@context' object ?
				 */
				.put("language", "en") //

				/*
				 * todo-0: I put this here very early on during mastodon testing. Need to see if we can get rid of
				 * this, and still be 'compatible' with Mastodon.
				 */
				.put("toot", "http://joinmastodon.org/ns#");
	}

	/*
	 * Need to check if this works using the 'to and cc' arrays that are the same as the ones built
	 * above (in newNoteObject() function)
	 */
	public APObj newCreateMessage(APObj object, String fromActor, List<String> toActors, String noteUrl, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val(ActPubConstants.CONTEXT_STREAMS) //
				.val(newContextObj()));

		// this 'id' was an early WAG, and needs a fresh look now that AP code is more complete.
		ret.put("id", noteUrl + "&apCreateTime=" + idTime);
		ret.put("type", "Create");
		ret.put("actor", fromActor);
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("object", object);

		ret.put("to", new APList() //
				.vals(toActors) //
				.val(ActPubConstants.CONTEXT_STREAMS + "#Public"));

		// LinkedList<String> ccArray = new LinkedList<>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);
		return ret;
	}
}
