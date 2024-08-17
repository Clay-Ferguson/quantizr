package quanta.postgres;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import quanta.config.ServiceBase;
import quanta.postgres.table.Tran;
import quanta.postgres.table.UserAccount;

@Component 
public class PaymentService extends ServiceBase {
    @SuppressWarnings("unused")
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public String printTransactions() {
        StringBuilder sb = new StringBuilder();
        Iterable<Tran> trans = svc_tranRepo.findAll();

        for (Tran tran : trans) {
            sb.append("Tran ID: " + tran.getId() + ", User ID: " + tran.getUserAccount().getId() + ", Amount: "
                    + tran.getAmt() + ", Timestamp: " + tran.getTs() + ", Service: " + tran.getTransType() + "\n");
            if (tran.getDetail() != null) {
                sb.append("Detail: " + tran.getDetail().toString() + "\n");
            }
        }
        return sb.toString();
    }

    public String printUsers() {
        StringBuilder sb = new StringBuilder();
        Iterable<UserAccount> userAccounts = svc_userRepo.findAll();

        for (UserAccount userAccount : userAccounts) {
            sb.append("User ID: " + userAccount.getId() + ", Mongo ID: " + userAccount.getMongoId() + "\n");
        }
        return sb.toString();
    }
}

