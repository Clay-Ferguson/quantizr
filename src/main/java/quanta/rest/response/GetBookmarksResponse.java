
package quanta.rest.response;

import java.util.List;
import quanta.model.client.Bookmark;
import quanta.rest.response.base.ResponseBase;

public class GetBookmarksResponse extends ResponseBase {
    private List<Bookmark> bookmarks;

    public List<Bookmark> getBookmarks() {
        return this.bookmarks;
    }
    
    public void setBookmarks(final List<Bookmark> bookmarks) {
        this.bookmarks = bookmarks;
    }

    public GetBookmarksResponse() {
    }
}
