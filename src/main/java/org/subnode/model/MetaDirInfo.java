package org.subnode.model;

import java.util.LinkedList;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MetaDirInfo {
    @JsonProperty("files")
    private LinkedList<String> files;

    public LinkedList<String> getFiles() {
        return files;
    };

    public void setFiles(LinkedList<String> files) {
        this.files = files;
    };
}