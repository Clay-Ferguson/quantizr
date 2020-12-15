package org.subnode.actpub;

public class ActPubConstants {
    // todo-0: For all my 'gets' that return this type, should I also make sure it works (using curl for example) to return a JSON,
    // if the requester is just requesting pure JSON (i.e. application/json) ? I think I should.
    public static final String CONTENT_TYPE_JSON_ACTIVITY = "application/activity+json; charset=utf-8";

	public static final String CONTENT_TYPE_JSON_LD = "application/ld+json; charset=utf-8";
    public static final String CONTENT_TYPE_JSON_JRD = "application/jrd+json; charset=utf-8";
    
    public static final String ACTOR_PATH = "/ap/u";

    public static final String CONTEXT_STREAMS = "https://www.w3.org/ns/activitystreams";
}
