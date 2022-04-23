package quanta.model.ipfs.dag;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MerkleCid {
    @JsonProperty("/")
    private String path;

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
