package quanta.model.client.geminiai;

import java.math.BigDecimal;
import java.util.List;

public class GeminiChatResponse {
    private List<GeminiChatCandidate> candidates;

    // transient, not part of pojo
    public BigDecimal credit;

    public GeminiChatResponse() {}

    public GeminiChatResponse(List<GeminiChatCandidate> candidates) {
        this.candidates = candidates;
    }

    public List<GeminiChatCandidate> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<GeminiChatCandidate> candidates) {
        this.candidates = candidates;
    }
}
