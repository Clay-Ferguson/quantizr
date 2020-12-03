package org.subnode.actpub;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.subnode.config.AppProp;

@Controller
@CrossOrigin
public class ActPubFactory {
	private static final Logger log = LoggerFactory.getLogger(ActPubFactory.class);

	@Autowired
	private AppProp appProp;

	public APObj newCreateMessageForNote(String actor, String inReplyTo, String content, String toActor,
			String noteUrl) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		log.debug("sending note to actor[" + actor + "] inReplyTo[" + inReplyTo + "] toActor[" + toActor + "]");
		return newCreateMessage(newNoteObject(actor, inReplyTo, content, toActor, noteUrl, now), actor, toActor,
				noteUrl, now);
	}

	public APObj newNoteObject(String attributedTo, String inReplyTo, String content, String toActor, String noteUrl,
			ZonedDateTime now) {
		APObj ret = new APObj();

		LinkedList<Object> contextArray = new LinkedList<Object>();
		contextArray.add("https://www.w3.org/ns/activitystreams");
		contextArray.add(newContextObj());
		ret.put("@context", contextArray);

		ret.put("id", noteUrl);
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);

		// ret.put("inReplyTo", inReplyTo);
		ret.put("inReplyTo", null); // this is null for DMs (Direct Messages)

		ret.put("summary", null);
		ret.put("url", noteUrl);
		ret.put("sensitive", false);
		ret.put("content", content);

		LinkedList<String> toArray = new LinkedList<String>();
		toArray.add(toActor);
		toArray.add("https://www.w3.org/ns/activitystreams#Public");
		ret.put("to", toArray);

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);

		return ret;
	}

	public APObj newContextObj() {
		APObj ret = new APObj();
		ret.put("language", "en");
		ret.put("toot", "http://joinmastodon.org/ns#");
		return ret;
	}

	public APObj newCreateMessage(APObj object, String actor, String to, String noteUrl, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		APObj ret = new APObj();

		// ret.put("@context", "https://www.w3.org/ns/activitystreams");
		LinkedList<Object> contextArray = new LinkedList<Object>();
		contextArray.add("https://www.w3.org/ns/activitystreams");
		contextArray.add(newContextObj());
		ret.put("@context", contextArray);

		ret.put("id", noteUrl + "&apCreateTime=" + idTime);
		ret.put("type", "Create");
		ret.put("actor", actor);
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("object", object);

		LinkedList<String> toArray = new LinkedList<String>();
		toArray.add(to);
		toArray.add("https://www.w3.org/ns/activitystreams#Public");
		ret.put("to", toArray);

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);
		return ret;
	}
}
