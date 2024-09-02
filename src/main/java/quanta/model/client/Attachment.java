package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Transient;
import quanta.mongo.model.SubNode;
import quanta.util.TL;
import quanta.util.Util;

/*
 * todo-1: All the single letter abbreviated prop names in here were a bad idea. Run a conversion on
 * those to make them be full names, but be careful there are lots of uses of this on the client
 * side
 *
 * Use a static variable naming like "NodeLink.java" does for all property names.
 */
@JsonInclude(Include.NON_DEFAULT)
@JsonIgnoreProperties(ignoreUnknown = true)
public class Attachment {

    private Integer ordinal = 0;
    private Integer width = 0;
    private Integer height = 0;
    private String position;
    private String mime;
    private String fileName;
    private String cssSize;
    private Long size = 0L;
    private String bin;
    private String binData;
    private String url;
    private String aiPrompt;

    // Transient (not persisted)
    private SubNode ownerNode;

    // key in the SubNode hashmap that points to this. May be null unless retrieved
    // thru certain API cals
    // Transient (not persisted)
    private String key;

    public Attachment() {}

    public Attachment(SubNode ownerNode) {
        this.ownerNode = ownerNode;
    }

    public Attachment(org.bson.Document doc) {
        if (doc.containsKey("width"))
            setWidth(doc.getInteger("width"));
        if (doc.containsKey("height"))
            setHeight(doc.getInteger("height"));
        if (doc.containsKey("position"))
            setPosition(doc.getString("position"));
        if (doc.containsKey("mime"))
            setMime(doc.getString("mime"));
        if (doc.containsKey("fileName"))
            setFileName(doc.getString("fileName"));
        if (doc.containsKey("size"))
            setSize(doc.getLong("size"));
        if (doc.containsKey("bin"))
            setBin(doc.getString("bin"));
        if (doc.containsKey("binData"))
            setBinData(doc.getString("binData"));
        if (doc.containsKey("url"))
            setUrl(doc.getString("url"));
        if (doc.containsKey("cssSize"))
            setCssSize(doc.getString("cssSize"));
        if (doc.containsKey("ordinal"))
            setOrdinal(doc.getInteger("ordinal"));
        if (doc.containsKey("aiPrompt"))
            setAiPrompt(doc.getString("aiPrompt"));
    }

    @JsonProperty("w")
    public Integer getWidth() {
        return width;
    }

    @JsonProperty("w")
    public void setWidth(Integer width) {
        if (Util.equalObjs(width, this.width))
            return;
        TL.dirty(ownerNode);
        this.width = width;
    }

    @JsonProperty("h")
    public Integer getHeight() {
        return height;
    }

    @JsonProperty("h")
    public void setHeight(Integer height) {
        if (Util.equalObjs(height, this.height))
            return;
        TL.dirty(ownerNode);
        this.height = height;
    }

    @JsonProperty("p")
    public String getPosition() {
        return position;
    }

    @JsonProperty("p")
    public void setPosition(String position) {
        if (Util.equalObjs(position, this.position))
            return;
        TL.dirty(ownerNode);
        this.position = position;
    }

    @JsonProperty("m")
    public String getMime() {
        return mime;
    }

    @JsonProperty("m")
    public void setMime(String mime) {
        if (Util.equalObjs(mime, this.mime))
            return;
        TL.dirty(ownerNode);
        this.mime = mime;
    }

    @JsonProperty("f")
    public String getFileName() {
        return fileName;
    }

    @JsonProperty("f")
    public void setFileName(String fileName) {
        if (Util.equalObjs(fileName, this.fileName))
            return;
        TL.dirty(ownerNode);
        this.fileName = fileName;
    }

    @JsonProperty("s")
    public Long getSize() {
        return size;
    }

    @JsonProperty("s")
    public void setSize(Long size) {
        if (Util.equalObjs(size, this.size))
            return;
        TL.dirty(ownerNode);
        this.size = size;
    }

    @JsonProperty("b")
    public String getBin() {
        return bin;
    }

    @JsonProperty("b")
    public void setBin(String bin) {
        if (Util.equalObjs(bin, this.bin))
            return;
        TL.dirty(ownerNode);
        this.bin = bin;
    }

    @JsonProperty("d")
    public String getBinData() {
        return binData;
    }

    @JsonProperty("d")
    public void setBinData(String binData) {
        if (Util.equalObjs(binData, this.binData))
            return;
        TL.dirty(ownerNode);
        this.binData = binData;
    }

    @JsonProperty("u")
    public String getUrl() {
        return url;
    }

    @JsonProperty("u")
    public void setUrl(String url) {
        if (Util.equalObjs(url, this.url))
            return;
        TL.dirty(ownerNode);
        this.url = url;
    }

    @JsonProperty("c")
    public String getCssSize() {
        return cssSize;
    }

    @JsonProperty("c")
    public void setCssSize(String cssSize) {
        if (Util.equalObjs(cssSize, this.cssSize))
            return;
        TL.dirty(ownerNode);
        this.cssSize = cssSize;
    }

    @JsonProperty("o")
    public Integer getOrdinal() {
        return ordinal;
    }

    @JsonProperty("o")
    public void setOrdinal(Integer ordinal) {
        if (Util.equalObjs(ordinal, this.ordinal))
            return;
        TL.dirty(ownerNode);
        this.ordinal = ordinal;
    }

    @JsonProperty("ai")
    public String getAiPrompt() {
        return aiPrompt;
    }

    @JsonProperty("ai")
    public void setAiPrompt(String aiPrompt) {
        if (Util.equalObjs(aiPrompt, this.aiPrompt))
            return;
        TL.dirty(ownerNode);
        this.aiPrompt = aiPrompt;
    }

    @Transient
    @JsonIgnore
    public void setOwnerNode(SubNode ownerNode) {
        this.ownerNode = ownerNode;
    }

    @Transient
    @JsonIgnore
    public String getKey() {
        return key;
    }

    @Transient
    @JsonIgnore
    public void setKey(String key) {
        this.key = key;
    }
}
