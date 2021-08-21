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
import org.subnode.actpub.model.AP;
import org.subnode.actpub.model.APList;
import org.subnode.actpub.model.APOCreate;
import org.subnode.actpub.model.APOMention;
import org.subnode.actpub.model.APONote;
import org.subnode.actpub.model.APObj;
import org.subnode.actpub.model.APProp;

@Controller
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
		// log.debug("sending note from actor[" + fromActor + "] inReplyTo[" + inReplyTo);
		return newCreateMessage(
				newNoteObject(toUserNames, fromActor, inReplyTo, content, noteUrl, now, privateMessage, attachments), fromActor,
				toUserNames, noteUrl, now, privateMessage);
	}

	/**
	 * Creates a new 'note' object
	 */
	public APONote newNoteObject(List<String> toUserNames, String attributedTo, String inReplyTo, String content, String noteUrl,
			ZonedDateTime now, boolean privateMessage, APList attachments) {
		APONote ret = new APONote() //
				.put(APProp.id, noteUrl) //
				.put(APProp.published, now.format(DateTimeFormatter.ISO_INSTANT)) //
				.put(APProp.attributedTo, attributedTo) //
				.put(APProp.summary, null) //
				.put(APProp.url, noteUrl) //
				.put(APProp.sensitive, false) //
				.put(APProp.content, content);

		LinkedList<String> toList = new LinkedList<>();
		LinkedList<String> ccList = new LinkedList<>();

		APList tagList = new APList();
		for (String userName : toUserNames) {
			try {
				String actorUrl = apUtil.getActorUrlFromUserName(userName);
				if (actorUrl == null)
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
				tagList.val(new APOMention() //
						.put(APProp.href, actorUrl) //
						.put(APProp.name, "@" + userName));
			}
			// log and continue if any loop (user) fails here.
			catch (Exception e) {
				log.debug("failed adding user to message: " + userName + " -> " + e.getMessage());
			}
		}

		ret.put(APProp.tag, tagList);

		if (!privateMessage) {
			toList.add(APConst.CONTEXT_STREAMS_PUBLIC);

			/*
			 * public posts should always cc the followers of the person doing the post (the actor pointed to by
			 * attributedTo)
			 */
			APObj actor = apCache.actorsByUrl.get(attributedTo);
			if (actor != null) {
				ccList.add(AP.str(actor, APProp.followers));
			}
		}

		if (toList.size() > 0) {
			ret.put(APProp.to, toList);
		}

		if (ccList.size() > 0) {
			ret.put(APProp.cc, ccList);
		}

		ret.put(APProp.attachment, attachments);
		return ret;
	}

	/*
	 * Need to check if this works using the 'to and cc' arrays that are the same as the ones built
	 * above (in newNoteObject() function)
	 */
	public APOCreate newCreateMessage(APObj object, String fromActor, List<String> toUserNames, String noteUrl, ZonedDateTime now,
			boolean privateMessage) {
		String idTime = String.valueOf(now.toInstant().toEpochMilli());

		List<String> toActors = new LinkedList<>();
		List<String> ccActors = new LinkedList<>();
		for (String userName : toUserNames) {
			try {
				String actorUrl = apUtil.getActorUrlFromUserName(userName);
				if (actorUrl == null)
					continue;

				// if public message put all the individuals in the 'cc' and "...#Public" as the only 'to', else they go in the 'to'.
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

		APOCreate ret = new APOCreate() //
				// this 'id' was an early WAG, and needs a fresh look now that AP code is more complete.
				.put(APProp.id, noteUrl + "&apCreateTime=" + idTime) //
				.put(APProp.actor, fromActor) //
				.put(APProp.published, now.format(DateTimeFormatter.ISO_INSTANT)) //
				.put(APProp.object, object);

		if (toActors.size() > 0) {
			ret.put(APProp.to, new APList() //
					.vals(toActors)); //
		}

		if (ccActors.size() > 0) {
			ret.put(APProp.cc, new APList() //
					.vals(ccActors)); //
		}
		return ret;
	}
}
