package quanta.postgres;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TranRepository extends JpaRepository<Tran, Long> {
        @Query("SELECT count(t) FROM Tran t WHERE t.userAccount.mongoId = :mongoId")
        long countByMongoId(@Param("mongoId") String mongoId);

        @Query("SELECT p FROM Tran p JOIN FETCH p.userAccount")
        List<Tran> findAll();

        @Query(value = "SELECT SUM(CASE WHEN tran_type = 'C' THEN amt ELSE -amt END) " //
                        + "FROM tran WHERE user_id = :userId", nativeQuery = true)
        BigDecimal getBalByUserAccntId(@Param("userId") Long userId);

        @Query(value = "SELECT SUM(CASE WHEN t.tran_type = 'C' THEN t.amt ELSE -t.amt END) " //
                        + "FROM tran t JOIN user_accnt u ON t.user_id = u.id " + //
                        "WHERE u.mongo_id = :mongoId", nativeQuery = true)
        BigDecimal getBalByMongoId(@Param("mongoId") String mongoId);

        @Query("SELECT u.mongoId, u.userName, t.descCode, COUNT(t), SUM(t.amt), AVG(t.amt) " + //
                        "FROM Tran t " + //
                        "JOIN t.userAccount u " + //
                        "WHERE t.transType = :transType " + //
                        "GROUP BY u.mongoId, u.userName, t.descCode " + //
                        "ORDER BY u.userName")
        List<Object[]> findTranSummaryByUser(@Param("transType") String transType);

        @Query("SELECT t.ts, u.mongoId, u.userName, t.descCode, t.amt " + //
                        "FROM Tran t " + //
                        "JOIN t.userAccount u " + //
                        "ORDER BY t.ts DESC")
        List<Object[]> allTrans();
}
