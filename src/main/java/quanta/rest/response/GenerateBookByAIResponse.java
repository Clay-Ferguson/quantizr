package quanta.rest.response;

import java.math.BigDecimal;
import quanta.rest.response.base.ResponseBase;

public class GenerateBookByAIResponse extends ResponseBase {
    private String nodeId;
    private BigDecimal gptCredit; // user credit remaining

    public GenerateBookByAIResponse() {}

    public String getNodeId() {
        return this.nodeId;
    }

    public void setNodeId(final String nodeId) {
        this.nodeId = nodeId;
    }

    public BigDecimal getGptCredit() {
        return gptCredit;
    }

    public void setGptCredit(BigDecimal gptCredit) {
        this.gptCredit = gptCredit;
    }
}
