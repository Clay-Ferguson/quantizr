package quanta.model.client;

import org.springframework.data.mongodb.core.mapping.Field;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(Include.NON_DEFAULT)
@JsonIgnoreProperties(ignoreUnknown = true)
public class NodeLink {
    public static final String ID = "id";
    public static final String NAME = "name";
    public static final String EMBED = "embed";

    @Field(ID)
    private String nodeId;

    @Field(NAME)
    private String name;

    @Field(EMBED)
    private Boolean embed;

    public NodeLink() {}

    public NodeLink(org.bson.Document doc) {
        if (doc.containsKey(NodeLink.ID)) {
            setNodeId(doc.getString(NodeLink.ID));
        }
        
        if (doc.containsKey(NodeLink.NAME)) {
            setName(doc.getString(NodeLink.NAME));
        }
        
        if (doc.containsKey(NodeLink.EMBED)) {
            setEmbed(doc.getBoolean(NodeLink.EMBED));
        }
    }

    @JsonProperty(ID)
    public String getNodeId() {
        return nodeId;
    }

    @JsonProperty(ID)
    public void setNodeId(String nodeId) {
        this.nodeId = nodeId;
    }

    @JsonProperty(NAME)
    public String getName() {
        return name;
    }

    @JsonProperty(NAME)
    public void setName(String name) {
        this.name = name;
    }

    @JsonProperty(EMBED)
    public Boolean getEmbed() {
        return embed;
    }

    @JsonProperty(EMBED)
    public void setEmbed(Boolean embed) {
        this.embed = embed;
    }
}
