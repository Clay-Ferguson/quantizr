package quanta.actpub.model;

import static quanta.util.Util.ok;
import quanta.actpub.APConst;

/**
 * Note object
 */
public class APONote extends APObj {
    public APONote() {
        put(context, new APList() //
                .val(APConst.CONTEXT_STREAMS) //
                .val(new APOLanguage()));
        put(type, APType.Note);
    }

    public APONote(String id, String published, String attributedTo, String summary, String url, boolean sensitive,
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
    public APONote put(String key, Object val) {
        super.put(key, val);
        return this;
    }
}
