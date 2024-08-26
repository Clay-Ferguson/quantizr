package quanta.postgres.repo;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import quanta.postgres.table.Tran;

/*
 * IMPORTANT:
 *
 * The 'save()' method on this class seems to always fail unless the transaction manager bean is
 * named 'transactionManager'. We neeed to worry about names becasue the @Transactional annotation
 * is used for MongoDb and for PostgreSQL and the names of the beans must be different. So as long
 * as this PostgreSQL repository is the only one demanding we have a bean named 'transactionManager'
 * we should be fine, and our MongoDb one is named "mongoTm"
 */

@Repository
@Transactional("transactionManager")
public interface TranRepository extends JpaRepository<Tran, Long> {
        @Query("SELECT count(t) FROM Tran t WHERE t.userAccount.mongoId = :mongoId")
        long countByMongoId(@Param("mongoId") String mongoId);

        @Query("SELECT p FROM Tran p JOIN FETCH p.userAccount")
        List<Tran> findAll();

        @Query(value = """
SELECT SUM(CASE WHEN tran_type = 'C' THEN amt ELSE -amt END) 
  FROM tran WHERE user_id = :userId""", nativeQuery = true)
        BigDecimal getBalByUserAccntId(@Param("userId") Long userId);

        @Query(value = """
SELECT SUM(CASE WHEN t.tran_type = 'C' THEN t.amt ELSE -t.amt END) 
  FROM tran t JOIN user_accnt u ON t.user_id = u.id 
  WHERE u.mongo_id = :mongoId""", nativeQuery = true)
        BigDecimal getBalByMongoId(@Param("mongoId") String mongoId);

        @Query("""
SELECT u.userName, t.descCode, COUNT(t), SUM(t.amt) 
  FROM Tran t 
  JOIN t.userAccount u 
  WHERE t.transType = :transType 
  GROUP BY u.userName, t.descCode 
  ORDER BY u.userName""")
        List<Object[]> findTranSummaryByUser(@Param("transType") String transType);

        @Query("""
SELECT t.id, t.ts, u.userName, t.descCode, t.amt 
  FROM Tran t 
  JOIN t.userAccount u 
  ORDER BY t.ts DESC""")
        List<Object[]> allTrans();

        // we use a native query instead of a JPQL query because of a limitation in JPQL
        @Query(value = """
SELECT u.user_name, SUM(CASE WHEN t.tran_type = 'C' THEN t.amt ELSE -t.amt END) AS balance 
  FROM tran t 
  JOIN user_accnt u ON t.user_id = u.id 
  GROUP BY u.mongo_id, u.user_name 
  ORDER BY u.user_name""", nativeQuery = true)
        List<Object[]> findAllUserBalances();
}
