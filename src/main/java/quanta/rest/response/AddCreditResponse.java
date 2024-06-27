package quanta.rest.response;

import java.math.BigDecimal;
import quanta.rest.response.base.ResponseBase;

public class AddCreditResponse extends ResponseBase {
    private BigDecimal balance;

    public BigDecimal getBalance() {
        return balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }
}
