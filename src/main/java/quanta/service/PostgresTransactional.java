package quanta.service;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import quanta.config.ServiceBase;
import quanta.mongo.model.SubNode;
import quanta.postgres.table.Tran;
import quanta.rest.response.AddCreditResponse;

/*
 * This service is a pure wrapper layer where all Postgres Transactions are done. We need this
 * because of the ugly design of Spring where calling a transactional method from another class is the ONLY way
 * to guarantee the call will go thru the Spring Proxy. In other words if you call a "@Transactional" method from
 * the same class, it will not go thru the Spring Proxy and the transaction will not be started.
 * 
 * Note: Putting @Transactional on this class makes all public methods transactional.
 */
@Component
@Transactional("transactionManager")
public class PostgresTransactional extends ServiceBase {
    public List<String> getAllTableNames() {
        return svc_pgSvc.getAllTableNames();
    }

    public boolean initialGrant(String userId, String userName) {
        return svc_user.initialGrant(userId, userName);
    }

    public AddCreditResponse cm_addCredit(String userId, BigDecimal amount) {
        return svc_user.addCredit(userId, amount);
    }

    public Tran addCreditByEmail(String emailAdr, BigDecimal amount, Long timestamp) {
        return svc_user.addCreditByEmail(emailAdr, amount, timestamp);
    }

    public BigDecimal updateUserCredit(SubNode userNode, BigDecimal curBal, BigDecimal cost, String serviceCode) {
        return svc_aiUtil.updateUserCredit(userNode, curBal, cost, serviceCode);
    }
}

