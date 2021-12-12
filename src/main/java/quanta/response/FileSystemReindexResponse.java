package quanta.response;

import quanta.response.base.ResponseBase;

public class FileSystemReindexResponse extends ResponseBase {
    private String report;

    public String getReport() {
        return report;
    }

    public void setReport(String report) {
        this.report = report;
    }
}
