package quanta.model.client;

import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import quanta.mongo.model.SubNode;
import quanta.util.TL;
import quanta.util.Util;

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
    // thru certain API calls
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

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        if (Util.equalObjs(width, this.width))
            return;
        TL.dirty(ownerNode);
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        if (Util.equalObjs(height, this.height))
            return;
        TL.dirty(ownerNode);
        this.height = height;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        if (Util.equalObjs(position, this.position))
            return;
        TL.dirty(ownerNode);
        this.position = position;
    }

    public String getMime() {
        return mime;
    }

    public void setMime(String mime) {
        if (Util.equalObjs(mime, this.mime))
            return;
        TL.dirty(ownerNode);
        this.mime = mime;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        if (Util.equalObjs(fileName, this.fileName))
            return;
        TL.dirty(ownerNode);
        this.fileName = fileName;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        if (Util.equalObjs(size, this.size))
            return;
        TL.dirty(ownerNode);
        this.size = size;
    }

    public String getBin() {
        return bin;
    }

    public void setBin(String bin) {
        if (Util.equalObjs(bin, this.bin))
            return;
        TL.dirty(ownerNode);
        this.bin = bin;
    }

    public String getBinData() {
        return binData;
    }

    public void setBinData(String binData) {
        if (Util.equalObjs(binData, this.binData))
            return;
        TL.dirty(ownerNode);
        this.binData = binData;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        if (Util.equalObjs(url, this.url))
            return;
        TL.dirty(ownerNode);
        this.url = url;
    }

    public String getCssSize() {
        return cssSize;
    }

    public void setCssSize(String cssSize) {
        if (Util.equalObjs(cssSize, this.cssSize))
            return;
        TL.dirty(ownerNode);
        this.cssSize = cssSize;
    }

    public Integer getOrdinal() {
        return ordinal;
    }

    public void setOrdinal(Integer ordinal) {
        if (Util.equalObjs(ordinal, this.ordinal))
            return;
        TL.dirty(ownerNode);
        this.ordinal = ordinal;
    }

    public String getAiPrompt() {
        return aiPrompt;
    }

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
