package quanta.postgres.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.transaction.Transactional;
import quanta.postgres.table.UserAccount;

public interface UserRepository extends JpaRepository<UserAccount, Long> {
    UserAccount findByMongoId(String mongoId);

    @Transactional
    void deleteByMongoId(String mongoId);
}
