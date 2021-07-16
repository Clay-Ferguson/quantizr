package org.subnode.request;

import org.subnode.request.base.RequestBase;

public class GetMultiRssRequest extends RequestBase {
    private String urls;
    private Integer page;

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public String getUrls() {
        return urls;
    }

    public void setUrls(String urls) {
        this.urls = urls;
    }
}
