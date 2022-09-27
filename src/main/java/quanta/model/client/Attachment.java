package quanta.model.client;

import org.springframework.data.annotation.Transient;
import com.fasterxml.jackson.annotation.JsonIgnore;
import quanta.mongo.model.SubNode;
import quanta.util.ThreadLocals;

// todo-att: add logic to every dirty() call in here to check to be sure the value DID change before setting dirty.
// todo-att: configure JSON serializer to leave out NULLs, zeroes, and false, to make object smaller.
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

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        ThreadLocals.dirty(ownerNode);
        this.width = width;
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        ThreadLocals.dirty(ownerNode);
        this.height = height;
    }

    public String getMime() {
        return mime;
    }

    public void setMime(String mime) {
        ThreadLocals.dirty(ownerNode);
        this.mime = mime;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        ThreadLocals.dirty(ownerNode);
        this.fileName = fileName;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        ThreadLocals.dirty(ownerNode);
        this.size = size;
    }

    public String getBin() {
        return bin;
    }

    public void setBin(String bin) {
        ThreadLocals.dirty(ownerNode);
        this.bin = bin;
    }

    public String getBinData() {
        return binData;
    }

    public void setBinData(String binData) {
        ThreadLocals.dirty(ownerNode);
        this.binData = binData;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        ThreadLocals.dirty(ownerNode);
        this.url = url;
    }

    public String getDataUrl() {
        return dataUrl;
    }

    public void setDataUrl(String dataUrl) {
        ThreadLocals.dirty(ownerNode);
        this.dataUrl = dataUrl;
    }

    public String getIpfsLink() {
        return ipfsLink;
    }

    public void setIpfsLink(String ipfsLink) {
        ThreadLocals.dirty(ownerNode);
        this.ipfsLink = ipfsLink;
    }

    public String getIpfsRef() {
        return ipfsRef;
    }

    public void setIpfsRef(String ipfsRef) {
        ThreadLocals.dirty(ownerNode);
        this.ipfsRef = ipfsRef;
    }

    public String getCssSize() {
        return cssSize;
    }

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
