package quanta.actpub.model;

import static quanta.util.Util.ok;
import quanta.actpub.APConst;

/**
 * ChatMessage type
 * 
 * todo-1: This was a bandaid to add this type, and I think my actor object
 * needs to specify if it supports this AND I haven't even looked at the AP
 * spec regarding this type yet. 
 */
public class APOChatMessage extends APObj {
    public APOChatMessage() {
        put(context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(type, APType.ChatMessage);
    }

    public APOChatMessage(String id, String published, String attributedTo, String summary, String url, boolean sensitive,
            String content, APList to) {
        this();
        put(APObj.id, id);
        put(APObj.published, published);
        put(APObj.attributedTo, attributedTo);
        put(APObj.summary, summary);
        put(APObj.url, url);
        put(APObj.sensitive, sensitive);
        put(APObj.content, content);
        if (ok(to)) {
            put(APObj.to, to);
        }
    }

    @Override
    public APOChatMessage put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
