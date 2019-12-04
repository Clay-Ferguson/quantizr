package org.subnode.response;

import org.subnode.response.base.ResponseBase;


public class FileSystemReindexResponse extends ResponseBase {
    private String report;

    public String getReport() {
        return report;
    }

    public void setReport(String report) {
        this.report = report;
    }
}
