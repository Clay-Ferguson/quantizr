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

	public APObj newCreateMessageForNote(String toUserName, String fromActor, String inReplyTo, String content,
			String toActor, String noteUrl, boolean privateMessage, APList attachments) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		log.debug("sending note from actor[" + fromActor + "] inReplyTo[" + inReplyTo + "] toActor[" + toActor + "]");
		return newCreateMessage(
				newNoteObject(toUserName, fromActor, inReplyTo, content, toActor, noteUrl, now, privateMessage, attachments), fromActor,
				toActor, noteUrl, now);
	}

	public APObj newNoteObject(String toUserName, String attributedTo, String inReplyTo, String content, String toActor,
			String noteUrl, ZonedDateTime now, boolean privateMessage, APList attachments) {
		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val(ActPubConstants.CONTEXT_STREAMS) //
				.val(newContextObj()));

		ret.put("id", noteUrl);
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);

		//Note: inReplyTo can be null here, and this is fine.
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
			toArray.add(ActPubConstants.CONTEXT_STREAMS + "#Public");
		}
		ret.put("to", toArray);

		ret.put("attachment", attachments);

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

	public APObj newCreateMessage(APObj object, String fromActor, String to, String noteUrl, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val(ActPubConstants.CONTEXT_STREAMS) //
				.val(newContextObj()));

		ret.put("id", noteUrl + "&apCreateTime=" + idTime);
		ret.put("type", "Create");
		ret.put("actor", fromActor);
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("object", object);

		ret.put("to", new APList() //
				.val(to) //
				.val(ActPubConstants.CONTEXT_STREAMS + "#Public"));

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);
		return ret;
	}
}
