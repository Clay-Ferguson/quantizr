package org.subnode.actpub;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

@Controller
@CrossOrigin
public class ActPubFactory {
	private static final Logger log = LoggerFactory.getLogger(ActPubFactory.class);

	public APObj newCreateMessageForNote(String toUserName, String actor, String inReplyTo, String content,
			String toActor, String noteUrl, boolean privateMessage) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		log.debug("sending note to actor[" + actor + "] inReplyTo[" + inReplyTo + "] toActor[" + toActor + "]");
		return newCreateMessage(
				newNoteObject(toUserName, actor, inReplyTo, content, toActor, noteUrl, now, privateMessage), actor,
				toActor, noteUrl, now);
	}

	public APObj newNoteObject(String toUserName, String attributedTo, String inReplyTo, String content, String toActor,
			String noteUrl, ZonedDateTime now, boolean privateMessage) {
		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val("https://www.w3.org/ns/activitystreams") //
				.val(newContextObj()));

		ret.put("id", noteUrl);
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);

		if (privateMessage) {
			ret.put("inReplyTo", inReplyTo);
		} else {
			ret.put("inReplyTo", null);
		}

		ret.put("summary", null);
		ret.put("url", noteUrl);
		ret.put("sensitive", false);
		ret.put("content", content);

		LinkedList<String> toArray = new LinkedList<String>();
		toArray.add(toActor);
		if (!privateMessage) {
			toArray.add("https://www.w3.org/ns/activitystreams#Public");
		}
		ret.put("to", toArray);

		ret.put("tag", new APList().val(new APObj() //
				.put("type", "Mention") //
				.put("href", toActor) //
				.put("name", "@" + toUserName) // prepend character to make it like '@user@server.com'
		));

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);

		return ret;
	}

	public APObj newContextObj() {
		return new APObj() //
				.put("language", "en") //
				.put("toot", "http://joinmastodon.org/ns#");
	}

	public APObj newCreateMessage(APObj object, String actor, String to, String noteUrl, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val("https://www.w3.org/ns/activitystreams") //
				.val(newContextObj()));

		ret.put("id", noteUrl + "&apCreateTime=" + idTime);
		ret.put("type", "Create");
		ret.put("actor", actor);
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("object", object);

		ret.put("to", new APList() //
				.val(to) //
				.val("https://www.w3.org/ns/activitystreams#Public"));

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);
		return ret;
	}
}
