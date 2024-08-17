package quanta.postgres.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import quanta.postgres.table.UserAccount;

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
public interface UserRepository extends JpaRepository<UserAccount, Long> {
    UserAccount findByMongoId(String mongoId);

    void deleteByMongoId(String mongoId);
}
