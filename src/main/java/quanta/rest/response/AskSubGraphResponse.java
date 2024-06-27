
package quanta.rest.response;

import java.math.BigDecimal;
import quanta.rest.response.base.ResponseBase;

public class AskSubGraphResponse extends ResponseBase {
    private String answer;
    private BigDecimal gptCredit; // user credit remaining

    public BigDecimal getGptCredit() {
        return gptCredit;
    }

    public void setGptCredit(BigDecimal gptCredit) {
        this.gptCredit = gptCredit;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
