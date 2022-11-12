package quanta.actpub.model;

// Holds something like this, but type can also be "Tag?" in the future maybe.
// Note that the correct thing to have in href is the ActorID (not actor URL), and the server should be able
// to respond to requests for HTML of that ActorId by returning some good HTML for that user.
    // "type" : "Mention",
	// "href" : "https://fosstodon.org/users/atoponce", (this is ap:actorId)
	// "name" : "@atoponce"
public class APOTag extends APObj {
    APOTag() {
    }

    public APOTag(String type, String href, String name) {
        put(APObj.type, type);
        put(APObj.href, href);
        put(APObj.name, name);
    }

    @Override
    public APOTag put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
