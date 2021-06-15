package org.subnode.response;

import java.util.List;
import org.subnode.model.client.Bookmark;
import org.subnode.response.base.ResponseBase;

public class GetBookmarksResponse extends ResponseBase {
    private List<Bookmark> bookmarks;

    public List<Bookmark> getBookmarks() {
        return bookmarks;
    }

    public void setBookmarks(List<Bookmark> bookmarks) {
        this.bookmarks = bookmarks;
    }
}
