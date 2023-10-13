package quanta.postgres;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;

@Component
public class PaymentService extends ServiceBase {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public String printTransactions() {
        StringBuilder sb = new StringBuilder();
        Iterable<Transaction> transactions = transactionRepository.findAll();

        for (Transaction transaction : transactions) {
            sb.append("Transaction ID: " + transaction.getId() + ", User ID: " + transaction.getUserAccount().getId()
                    + ", Amount: " + transaction.getAmt() + ", Timestamp: " + transaction.getTs() + ", Service: "
                    + transaction.getTransType() + "\n");
            if (transaction.getDetail() != null) {
                sb.append("Detail: " + transaction.getDetail().toString() + "\n");
            }
        }
        return sb.toString();
    }

    public String printUsers() {
        StringBuilder sb = new StringBuilder();
        Iterable<UserAccount> userAccounts = userRepository.findAll();

        for (UserAccount userAccount : userAccounts) {
            sb.append("User ID: " + userAccount.getId() + ", Mongo ID: " + userAccount.getMongoId() + "\n");
        }
        return sb.toString();
    }
}

