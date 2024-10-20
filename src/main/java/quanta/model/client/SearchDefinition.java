package quanta.model.client;

public class SearchDefinition {
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

    public void setSearchProp(final String searchProp) {
        this.searchProp = searchProp;
    }
}
