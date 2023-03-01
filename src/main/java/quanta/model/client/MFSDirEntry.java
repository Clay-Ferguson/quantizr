package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonProperty;

public class MFSDirEntry {
    @JsonProperty("Name")
    private String name;

    @JsonProperty("Type")
    private Integer type;

    @JsonProperty("Size")
    private Integer size;

    @JsonProperty("Hash")
    private String hash;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getType() {
        return type;
    }

    public void setType(Integer type) {
        this.type = type;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public boolean isDir() {
        return type != null && type.intValue() == 1;
    }

    public boolean isFile() {
        return type != null && type.intValue() == 0;
    }
}
