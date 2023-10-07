package quanta.postgres;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    @Query("SELECT count(t) FROM Transaction t WHERE t.userAccount.mongoId = :mongoId")
    long countByMongoId(@Param("mongoId") String mongoId);

    @Query("SELECT p FROM Transaction p JOIN FETCH p.userAccount")
    List<Transaction> findAll();

    @Query(value = "SELECT SUM(CASE WHEN trans_type = 'C' THEN amt ELSE -amt END) "
            + "FROM transaction WHERE user_id = :userId", nativeQuery = true)
    BigDecimal getBalByUserAccntId(@Param("userId") Long userId);

    @Query(value = "SELECT SUM(CASE WHEN t.trans_type = 'C' THEN t.amt ELSE -t.amt END) "
            + "FROM transaction t JOIN user_accnt u ON t.user_id = u.id " + "WHERE u.mongo_id = :mongoId",
            nativeQuery = true)
    BigDecimal getBalByMongoId(@Param("mongoId") String mongoId);
}
