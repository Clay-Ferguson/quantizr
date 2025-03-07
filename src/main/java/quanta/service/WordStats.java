package quanta.service;

import java.util.HashSet;
import quanta.mongo.model.SubNode;

// todo-0: move into a models folder.
public class WordStats {
    public String word;
    public long count;
    public HashSet<String> usedWith;

    public void inc(SubNode node) {
        count++;
    }

    public WordStats(String word) {
        this.word = word;
    }

    public void addUsedWith(String word) {
        if (usedWith == null) {
            usedWith = new HashSet<String>();
        }
        usedWith.add(word);
    }
}
