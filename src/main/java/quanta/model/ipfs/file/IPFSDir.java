package quanta.model.ipfs.file;

import java.util.LinkedList;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IPFSDir {
    @JsonProperty("Entries")
    private LinkedList<IPFSDirEntry> entries;

    public LinkedList<IPFSDirEntry> getEntries() {
        return entries;
    }

    public void setEntries(LinkedList<IPFSDirEntry> entries) {
        this.entries = entries;
    }
}