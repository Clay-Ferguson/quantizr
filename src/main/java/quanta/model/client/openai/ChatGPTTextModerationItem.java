package quanta.model.client.openai;

import java.util.Map;

public class ChatGPTTextModerationItem {
    private boolean flagged;
    private Map<String, Boolean> categories;
    private Map<String, Double> categoryScores;

    public boolean isFlagged() {
        return flagged;
    }

    public void setFlagged(boolean flagged) {
        this.flagged = flagged;
    }

    public Map<String, Boolean> getCategories() {
        return categories;
    }

    public void setCategories(Map<String, Boolean> categories) {
        this.categories = categories;
    }

    public Map<String, Double> getCategoryScores() {
        return categoryScores;
    }

    public void setCategoryScores(Map<String, Double> categoryScores) {
        this.categoryScores = categoryScores;
    }
}
