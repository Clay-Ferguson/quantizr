package quanta.model.ipfs.file;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class IPFSDir {
    @JsonProperty("Entries")
    private List<IPFSDirEntry> entries;

    public List<IPFSDirEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<IPFSDirEntry> entries) {
        this.entries = entries;
    }
}