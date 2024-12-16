
package quanta.rest.response;

import java.math.BigDecimal;
import quanta.rest.response.base.ResponseBase;

public class AskSubGraphResponse extends ResponseBase {
    private String answer;

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }
}
