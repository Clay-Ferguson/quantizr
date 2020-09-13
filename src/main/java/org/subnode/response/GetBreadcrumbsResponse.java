package org.subnode.response;

import java.util.LinkedList;

import org.subnode.model.BreadcrumbInfo;
import org.subnode.response.base.ResponseBase;

public class GetBreadcrumbsResponse extends ResponseBase {
    private LinkedList<BreadcrumbInfo> breadcrumbs;

    public GetBreadcrumbsResponse() {
        
    }

    public LinkedList<BreadcrumbInfo> getBreadcrumbs() {
        return breadcrumbs;
    }

    public void setBreadcrumbs(LinkedList<BreadcrumbInfo> breadcrumbs) {
        this.breadcrumbs = breadcrumbs;
    }
}
