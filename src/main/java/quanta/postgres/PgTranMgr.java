package quanta.postgres;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.TransactionStatus;
import quanta.exception.base.RuntimeEx;

/**
 * PostgreSQL Transaction Manager
 * 
 * See also: MongoTranMgr.java
 */
public class PgTranMgr implements PlatformTransactionManager {
    private static Logger log = LoggerFactory.getLogger(PgTranMgr.class);
    private final PlatformTransactionManager delegate;
    private static final ThreadLocal<Boolean> tranActive = new ThreadLocal<>();

    public PgTranMgr(PlatformTransactionManager delegate) {
        this.delegate = delegate;
    }

    public static boolean isTranActive() {
        return Boolean.TRUE.equals(tranActive.get());
    }

    public static void ensureTran() {
        if (!isTranActive()) {
            throw new RuntimeEx("This method must be called within a PostgreSQL transaction.");
        }
    }

    @Override
    public TransactionStatus getTransaction(TransactionDefinition definition) throws TransactionException {
        TransactionStatus trans = delegate.getTransaction(definition);
        /*
         * We set the currentTransactdionName so that our Util.ensureTrans() method can be used in methods
         * where we want to be sure we're not calling outside the scope of a transaction.
         */
        tranActive.set(true);
        return trans;
    }

    @Override
    public void commit(TransactionStatus status) throws TransactionException {
        try {
            delegate.commit(status);
        } finally {
            tranActive.remove();
        }
    }

    @Override
    public void rollback(TransactionStatus status) throws TransactionException {
        try {
            delegate.rollback(status);
        } finally {
            tranActive.remove();
        }
    }
}
