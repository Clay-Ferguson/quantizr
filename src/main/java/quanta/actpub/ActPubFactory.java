package quanta.actpub;

import static quanta.util.Util.no;
import static quanta.util.Util.ok;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.actpub.model.AP;
import quanta.actpub.model.APList;
import quanta.actpub.model.APOChatMessage;
import quanta.actpub.model.APOCreate;
import quanta.actpub.model.APOMention;
import quanta.actpub.model.APONote;
import quanta.actpub.model.APObj;
import quanta.actpub.model.APType;
import quanta.config.ServiceBase;

/**
 * Convenience factory for some types of AP objects
 */
@Component
public class ActPubFactory extends ServiceBase {
	private static final Logger log = LoggerFactory.getLogger(ActPubFactory.class);

	/**
	 * Creates a new 'note' message
	 */
	public APObj newCreateForNote(HashSet<String> toUserNames, String fromActor, String inReplyTo, String replyToType,
			String content, String noteUrl, boolean privateMessage, APList attachments) {
		ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
		// log.debug("sending note from actor[" + fromActor + "] inReplyTo[" + inReplyTo);

		APObj payload =
				newNote(toUserNames, fromActor, inReplyTo, replyToType, content, noteUrl, now, privateMessage, attachments);

		return newCreate(payload, fromActor, toUserNames, noteUrl, now, privateMessage);
	}

	/**
	 * Creates a new 'Note' or 'ChatMessage' object, depending on what's being replied to.
	 */
	public APObj newNote(HashSet<String> toUserNames, String attributedTo, String inReplyTo, String replyToType,
			String content, String noteUrl, ZonedDateTime now, boolean privateMessage, APList attachments) {
		APObj ret = null;

		if (ok(content)) {
			// convert all double and single spaced lines to <br> for formatting, for servers that don't understand Markdown
			content = content.replace("\n", "<br>");
		}

		if (APType.ChatMessage.equals(replyToType)) {
			ret = new APOChatMessage(noteUrl, now.format(DateTimeFormatter.ISO_INSTANT), attributedTo, null, noteUrl, false,
					content, null);
		} else {
			ret = new APONote(noteUrl, now.format(DateTimeFormatter.ISO_INSTANT), attributedTo, null, noteUrl, false, content,
					null);
		}

		if (ok(inReplyTo)) {
			ret = ret.put(APObj.inReplyTo, inReplyTo);
		}

		LinkedList<String> toList = new LinkedList<>();
		LinkedList<String> ccList = new LinkedList<>();

		APList tagList = new APList();
		for (String userName : toUserNames) {
			try {
				String actorUrl = apUtil.getActorUrlFromForeignUserName(userName);

				// Local usernames will get a null here, by design, which is hopefully correct. We can call apUtil.makeActorUrlForUserName(userName)
				// for local users, but aren't doing that, by design.
				if (no(actorUrl))
					continue;

				/*
				 * For public messages Mastodon puts the "Public" target in 'to' and the mentioned users in 'cc', so
				 * we do that same thing
				 */
				if (!privateMessage) {
					ccList.add(actorUrl);
				} else {
					toList.add(actorUrl);
				}

				// prepend character to make it like '@user@server.com'
				tagList.val(new APOMention(actorUrl, "@" + userName));
			}
			// log and continue if any loop (user) fails here.
			catch (Exception e) {
				log.debug("failed adding user to message: " + userName + " -> " + e.getMessage());
			}
		}
		ret.put(APObj.tag, tagList);

		if (!privateMessage) {
			toList.add(APConst.CONTEXT_STREAMS_PUBLIC);

			/*
			 * public posts should always cc the followers of the person doing the post (the actor pointed to by
			 * attributedTo)
			 */
			APObj actor = apCache.actorsByUrl.get(attributedTo);
			if (ok(actor)) {
				ccList.add(AP.str(actor, APObj.followers));
			}
		}

		if (toList.size() > 0) {
			ret.put(APObj.to, toList);
		}

		if (ccList.size() > 0) {
			ret.put(APObj.cc, ccList);
		}

		ret.put(APObj.attachment, attachments);
		return ret;
	}

	/*
	 * Need to check if this works using the 'to and cc' arrays that are the same as the ones built
	 * above (in newNoteObject() function)
	 */
	public APOCreate newCreate(APObj object, String fromActor, HashSet<String> toUserNames, String noteUrl, ZonedDateTime now,
			boolean privateMessage) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		List<String> toActors = new LinkedList<>();
		List<String> ccActors = new LinkedList<>();
		for (String userName : toUserNames) {
			try {
				// Local usernames will get a null here, by design, which is hopefully correct. We can call apUtil.makeActorUrlForUserName(userName)
				// for local users, but aren't doing that, by design.
				String actorUrl = apUtil.getActorUrlFromForeignUserName(userName);
				if (no(actorUrl))
					continue;

				// if public message put all the individuals in the 'cc' and "...#Public" as the only 'to', else
				// they go in the 'to'.
				if (!privateMessage) {
					ccActors.add(actorUrl);
				} else {
					toActors.add(actorUrl);
				}
			}
			// log and continue if any loop (user) fails here.
			catch (Exception e) {
				log.debug("failed adding user in newCreateMessage: " + userName + " -> " + e.getMessage());
			}
		}

		if (!privateMessage) {
			toActors.add(APConst.CONTEXT_STREAMS_PUBLIC);
		}

		if (toActors.size() == 0) {
			throw new RuntimeException("toActors was empty.");
		}

		APOCreate ret = new APOCreate(noteUrl + "&apCreateTime=" + idTime, fromActor, //
				now.format(DateTimeFormatter.ISO_INSTANT), object, null);

		if (toActors.size() > 0) {
			ret.put(APObj.to, new APList() //
					.vals(toActors)); //
		}

		if (ccActors.size() > 0) {
			ret.put(APObj.cc, new APList() //
					.vals(ccActors)); //
		}
		return ret;
	}
}
