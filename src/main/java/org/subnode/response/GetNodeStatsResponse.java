package org.subnode.response;

import java.util.ArrayList;
import org.subnode.response.base.ResponseBase;

public class GetNodeStatsResponse extends ResponseBase {
    private String stats;
    private ArrayList<String> topSentences;
    private ArrayList<String> topWords;
    private ArrayList<String> topTags;
    private ArrayList<String> topMentions;

    public String getStats() {
        return stats;
    }

    public void setStats(String stats) {
        this.stats = stats;
    }

    public ArrayList<String> getTopSentences() {
        return topSentences;
    }

    public void setTopSentences(ArrayList<String> topSentences) {
        this.topSentences = topSentences;
    }

    public ArrayList<String> getTopWords() {
        return topWords;
    }

    public void setTopWords(ArrayList<String> topWords) {
        this.topWords = topWords;
    }

    public ArrayList<String> getTopTags() {
        return topTags;
    }

    public void setTopTags(ArrayList<String> topTags) {
        this.topTags = topTags;
    }

    public ArrayList<String> getTopMentions() {
        return topMentions;
    }

    public void setTopMentions(ArrayList<String> topMentions) {
        this.topMentions = topMentions;
    }
}
