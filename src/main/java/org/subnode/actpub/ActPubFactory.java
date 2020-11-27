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

	public APObj newCreateMessageForNote(String actor, String inReplyTo, String content, String toActor) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		return newCreateMessage(newNoteObject(actor, inReplyTo, content, toActor, now), actor, toActor, now);
	}

	public APObj newNoteObject(String attributedTo, String inReplyTo, String content, String toActor, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		// todo-0: does this url need to be responsive for the message send to succeed?
		String fullId = appProp.protocolHostAndPort() + "/ap/note/note-" + idTime;
		APObj ret = new APObj();
		ret.put("id", fullId);
		// ret.put("@context", "https://www.w3.org/ns/activitystreams");
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);
		ret.put("inReplyTo", inReplyTo);
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

	public APObj newCreateMessage(APObj object, String actor, String to, ZonedDateTime now) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		// todo-0: does this url need to be responsive for the message send to succeed?
		String fullId = appProp.protocolHostAndPort() + "/ap/create/create-" + idTime;
		APObj ret = new APObj();

		ret.put("@context", "https://www.w3.org/ns/activitystreams");
		ret.put("id", fullId);
		ret.put("type", "Create");
		ret.put("actor", actor);
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
