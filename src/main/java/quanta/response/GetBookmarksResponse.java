package quanta.response;

import java.util.List;
import quanta.model.client.Bookmark;
import quanta.response.base.ResponseBase;

public class GetBookmarksResponse extends ResponseBase {
    private List<Bookmark> bookmarks;

    public List<Bookmark> getBookmarks() {
        return bookmarks;
    }

    public void setBookmarks(List<Bookmark> bookmarks) {
        this.bookmarks = bookmarks;
    }
}
