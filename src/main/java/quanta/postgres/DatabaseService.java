package quanta.postgres;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import quanta.config.ServiceBase;
import quanta.postgres.table.UserAccount;
import quanta.util.XString;

@Component 
public class DatabaseService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(DatabaseService.class);

    @PersistenceContext
    private EntityManager entityManager;

    @SuppressWarnings("unchecked")
    public List<String> getAllTableNames() {
        return entityManager
                .createNativeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
                        String.class)
                .getResultList();
    }

    public String getInfo() {
        // log.debug("Postgres is enabled.");
        List<UserAccount> allUsers = svc_userRepo.findAll();
        log.debug("Number of users: " + allUsers.size());

        allUsers = svc_userRepo.findAll();
        log.debug("Number of users: " + allUsers.size());
        StringBuilder info = new StringBuilder();
        info.append("Tables: " + XString.prettyPrint(svc_pgTrans.getAllTableNames()) + "\n");
        info.append("\n");

        info.append("\nUsers:\n");
        info.append(svc_pgPayments.printUsers());

        info.append("\nTransactions:\n");
        info.append(svc_pgPayments.printTransactions());

        info.append("\n");
        return info.toString();
    }
}
