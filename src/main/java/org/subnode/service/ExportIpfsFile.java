package org.subnode.service;

public class ExportIpfsFile {
    private String fileName;
    private String cid;

    public ExportIpfsFile(String cid, String fileName) {
        this.cid = cid;
        this.fileName = fileName;
    }

    public String getFileName() {
        return fileName;
    }
    public void setFileName(String fileName) {
        this.fileName = fileName;
    }
    public String getCid() {
        return cid;
    }
    public void setCid(String cid) {
        this.cid = cid;
    }
}
