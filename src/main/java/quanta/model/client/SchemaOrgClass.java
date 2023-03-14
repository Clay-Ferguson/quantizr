package quanta.model.client;

import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

@JsonInclude(Include.NON_DEFAULT)
@JsonIgnoreProperties(ignoreUnknown = true)
public class SchemaOrgClass {
    private String id;
    private String comment;
    private String label;
    private List<SchemaOrgProp> props = new ArrayList<>();

    public SchemaOrgClass() {}

    public List<SchemaOrgProp> getProps() {
        return props;
    }

    public void setProps(List<SchemaOrgProp> props) {
        this.props = props;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
