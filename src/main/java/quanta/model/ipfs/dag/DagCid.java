package quanta.model.ipfs.dag;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DagCid {
    // NOTE: This prop actually holds a CID, not a path.
    @JsonProperty("/")
    private String path;

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
