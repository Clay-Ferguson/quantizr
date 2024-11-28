package quanta.model.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

@JsonInclude(Include.NON_DEFAULT)
@JsonIgnoreProperties(ignoreUnknown = true)

public class SearchDefinition {
    private String name;
    private String searchText;
    private String sortDir;
    private String sortField;
    private String searchProp;
    // fuzzy means you can get substring searches, where the substring is not on the FIRST characters of
    // a term
    private boolean fuzzy;
    private boolean caseSensitive;
    private boolean recursive;
    private boolean requirePriority;
    private boolean requireAttachment;
    private boolean requireDate;

    public SearchDefinition() {}

    public SearchDefinition(org.bson.Document doc) {
        if (doc.containsKey("name")) {
            setName(doc.getString("name"));
        }

        if (doc.containsKey("searchText")) {
            setSearchText(doc.getString("searchText"));
        }

        if (doc.containsKey("sortDir")) {
            setSortDir(doc.getString("sortDir"));
        }

        if (doc.containsKey("sortField")) {
            setSortField(doc.getString("sortField"));
        }

        if (doc.containsKey("searchProp")) {
            setSearchProp(doc.getString("searchProp"));
        }

        if (doc.containsKey("fuzzy")) {
            setFuzzy(doc.getBoolean("fuzzy"));
        }

        if (doc.containsKey("caseSensitive")) {
            setCaseSensitive(doc.getBoolean("caseSensitive"));
        }

        if (doc.containsKey("recursive")) {
            setRecursive(doc.getBoolean("recursive"));
        }

        if (doc.containsKey("requirePriority")) {
            setRequirePriority(doc.getBoolean("requirePriority"));
        }

        if (doc.containsKey("requireAttachment")) {
            setRequireAttachment(doc.getBoolean("requireAttachment"));
        }

        if (doc.containsKey("requireDate")) {
            setRequireDate(doc.getBoolean("requireDate"));
        }
    }

    public boolean isRecursive() {
        return recursive;
    }

    public void setRecursive(boolean recursive) {
        this.recursive = recursive;
    }

    public boolean isRequirePriority() {
        return requirePriority;
    }

    public void setRequirePriority(boolean requirePriority) {
        this.requirePriority = requirePriority;
    }

    public boolean isRequireAttachment() {
        return requireAttachment;
    }

    public void setRequireAttachment(boolean requireAttachment) {
        this.requireAttachment = requireAttachment;
    }

    public boolean isRequireDate() {
        return requireDate;
    }

    public void setRequireDate(boolean requireDate) {
        this.requireDate = requireDate;
    }

    public boolean isFuzzy() {
        return fuzzy;
    }

    public void setFuzzy(boolean fuzzy) {
        this.fuzzy = fuzzy;
    }

    public boolean isCaseSensitive() {
        return caseSensitive;
    }

    public void setCaseSensitive(boolean caseSensitive) {
        this.caseSensitive = caseSensitive;
    }

    public String getSortDir() {
        return sortDir;
    }

    public void setSortDir(String sortDir) {
        this.sortDir = sortDir;
    }

    public String getSortField() {
        return sortField;
    }

    public void setSortField(String sortField) {
        this.sortField = sortField;
    }

    public String getSearchText() {
        return this.searchText;
    }

    public void setSearchText(final String searchText) {
        this.searchText = searchText;
    }

    public String getSearchProp() {
        return this.searchProp;
    }

    public String getName() {
        return this.name;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public void setSearchProp(final String searchProp) {
        this.searchProp = searchProp;
    }
}
