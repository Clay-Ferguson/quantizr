
package quanta.response;

import quanta.response.base.ResponseBase;

public class AskSubGraphResponse extends ResponseBase {
    private String answer;
    private Double gptCredit; // user credit remaining

    public Double getGptCredit() {
        return gptCredit;
    }

    public void setGptCredit(Double gptCredit) {
        this.gptCredit = gptCredit;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
