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
import org.subnode.service.ActPubService;

@Controller
@CrossOrigin
public class ActPubFactory {
	@Autowired
	public ActPubService actPubService;
	
	private static final Logger log = LoggerFactory.getLogger(ActPubFactory.class);

	public APObj newCreateMessageForNote(List<String> toUserNames, String fromActor, String inReplyTo, String content,
			 String noteUrl, boolean privateMessage, APList attachments) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		log.debug("sending note from actor[" + fromActor + "] inReplyTo[" + inReplyTo);
		return newCreateMessage(
				newNoteObject(toUserNames, fromActor, inReplyTo, content, noteUrl, now, privateMessage, attachments),
				fromActor, toUserNames, noteUrl, now);
	}

	public APObj newNoteObject(List<String> toUserNames, String attributedTo, String inReplyTo, String content,
			String noteUrl, ZonedDateTime now, boolean privateMessage, APList attachments) {
		APObj ret = new APObj();

		ret.put("@context", new APList() //
				.val(ActPubConstants.CONTEXT_STREAMS) //
				.val(newContextObj()));

		ret.put("id", noteUrl);
		ret.put("type", "Note");
		ret.put("published", now.format(DateTimeFormatter.ISO_INSTANT));
		ret.put("attributedTo", attributedTo);

		// Note: inReplyTo can be null here, and this is fine.
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

		APList tagList = new APList();
		for (String userName : toUserNames) {
			APObj webFinger = actPubService.getWebFinger(userName);
			String actorUrl = actPubService.getActorUrlFromWebFingerObj(webFinger);

			toArray.add(actorUrl);
			tagList.val(new APObj() //
					.put("type", "Mention") //
					.put("href", actorUrl) //
					.put("name", "@" + userName)); // prepend character to make it like '@user@server.com'
		}
		ret.put("tag", tagList);

		if (!privateMessage) {
			toArray.add(ActPubConstants.CONTEXT_STREAMS + "#Public");
		}
		ret.put("to", toArray);
		ret.put("attachment", attachments);

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

	public APObj newCreateMessage(APObj object, String fromActor, List<String> toActors, String noteUrl, ZonedDateTime now) {
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
				.vals(toActors) //
				// todo-0: research this value (double check that DMs work, and are private)
				.val(ActPubConstants.CONTEXT_STREAMS + "#Public"));

		// LinkedList<String> ccArray = new LinkedList<String>();
		// ccArray.add("https://www.w3.org/ns/activitystreams#Public");
		// ret.put("cc", ccArray);
		return ret;
	}
}
