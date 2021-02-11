package org.subnode.service;

public class SentenceStats {
    public String sentence;
    public int score;
    public int sentenceIdx;

    public SentenceStats(String sentence, int score, int sentenceIdx) {
        this.sentence = sentence;
        this.score = score;
        this.sentenceIdx = sentenceIdx;
    }
}
