package quanta.model.client;

import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;

@JsonInclude(Include.NON_NULL)
public class Attachment {
    private int width;          // IMG_WIDTH	"sn:imgWidth"
    private int height;         // IMG_HEIGHT	"sn:imgHeight"
    private String mime;        // BIN_MIME	    "sn:mimeType"
    private String fileName;    // BIN_FILENAME	"sn:fileName"
    private String cssSize;     // IMG_SIZE	    "sn:imgSize"
    private long size;          // BIN_SIZE	    "sn:size"
    private String bin;         // BIN		    "bin"
    private String binData;     // BIN_DATA     "sn:jcrData"
    private String url;         // BIN_URL		"sn:extUrl"
    private String dataUrl;     // BIN_DATA_URL	"sn:dataUrl"
    private String ipfsLink;    // IPFS_LINK 	"ipfs:link"
    private String ipfsRef;     // IPFS_REF 	"ipfs:ref"

    private SubNode ownerNode;

    public Attachment() {
    }

    public Attachment(SubNode ownerNode) {
        this.ownerNode = ownerNode;
    }

    @JsonProperty("w")
    public int getWidth() {
        return width;
    }

    @JsonProperty("w")
    public void setWidth(int width) {
        ThreadLocals.dirty(ownerNode);
        this.width = width;
    }

    @JsonProperty("h")
    public int getHeight() {
        return height;
    }

    @JsonProperty("h")
    public void setHeight(int height) {
        ThreadLocals.dirty(ownerNode);
        this.height = height;
    }

    @JsonProperty("m")
    public String getMime() {
        return mime;
    }

    @JsonProperty("m")
    public void setMime(String mime) {
        ThreadLocals.dirty(ownerNode);
        this.mime = mime;
    }

    @JsonProperty("f")
    public String getFileName() {
        return fileName;
    }

    @JsonProperty("f")
    public void setFileName(String fileName) {
        ThreadLocals.dirty(ownerNode);
        this.fileName = fileName;
    }

    @JsonProperty("s")
    public long getSize() {
        return size;
    }

    @JsonProperty("s")
    public void setSize(long size) {
        ThreadLocals.dirty(ownerNode);
        this.size = size;
    }

    @JsonProperty("b")
    public String getBin() {
        return bin;
    }

    @JsonProperty("b")
    public void setBin(String bin) {
        ThreadLocals.dirty(ownerNode);
        this.bin = bin;
    }

    @JsonProperty("d")
    public String getBinData() {
        return binData;
    }

    @JsonProperty("d")
    public void setBinData(String binData) {
        ThreadLocals.dirty(ownerNode);
        this.binData = binData;
    }

    @JsonProperty("u")
    public String getUrl() {
        return url;
    }

    @JsonProperty("u")
    public void setUrl(String url) {
        ThreadLocals.dirty(ownerNode);
        this.url = url;
    }

    @JsonProperty("du")
    public String getDataUrl() {
        return dataUrl;
    }

    @JsonProperty("du")
    public void setDataUrl(String dataUrl) {
        ThreadLocals.dirty(ownerNode);
        this.dataUrl = dataUrl;
    }

    @JsonProperty("il")
    public String getIpfsLink() {
        return ipfsLink;
    }

    @JsonProperty("il")
    public void setIpfsLink(String ipfsLink) {
        ThreadLocals.dirty(ownerNode);
        this.ipfsLink = ipfsLink;
    }

    @JsonProperty("ir")
    public String getIpfsRef() {
        return ipfsRef;
    }

    @JsonProperty("ir")
    public void setIpfsRef(String ipfsRef) {
        ThreadLocals.dirty(ownerNode);
        this.ipfsRef = ipfsRef;
    }

    @JsonProperty("c")
    public String getCssSize() {
        return cssSize;
    }

    @JsonProperty("c")
    public void setCssSize(String cssSize) {
        ThreadLocals.dirty(ownerNode);
        this.cssSize = cssSize;
    }

    @Transient
	@JsonIgnore
    public SubNode getOwnerNode() {
        return ownerNode;
    }

    @Transient
	@JsonIgnore
    public void setOwnerNode(SubNode ownerNode) {
        this.ownerNode = ownerNode;
    }
}
