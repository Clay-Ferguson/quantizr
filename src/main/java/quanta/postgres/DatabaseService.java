package quanta.postgres;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import quanta.config.ServiceBase;
import quanta.postgres.table.UserAccount;
import quanta.util.XString;

@Component
public class DatabaseService extends ServiceBase {
    private static Logger log = LoggerFactory.getLogger(DatabaseService.class);

    @PersistenceContext
    private EntityManager entityManager;

    @SuppressWarnings("unchecked")
    @Transactional
    public List<String> getAllTableNames() {
        return entityManager
                .createNativeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
                        String.class)
                .getResultList();
    }

    public String getInfo() {
        // log.debug("Postgres is enabled.");
        List<UserAccount> allUsers = userRepository.findAll();
        log.debug("Number of users: " + allUsers.size());

        allUsers = userRepository.findAll();
        log.debug("Number of users: " + allUsers.size());
        StringBuilder info = new StringBuilder();
        info.append("Tables: " + XString.prettyPrint(getAllTableNames()) + "\n");
        info.append("\n");

        info.append("\nUsers:\n");
        info.append(pgPayments.printUsers());

        info.append("\nTransactions:\n");
        info.append(pgPayments.printTransactions());

        info.append("\n");
        return info.toString();
    }
}
