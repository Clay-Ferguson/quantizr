package quanta.postgres;

import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.transaction.Transactional;

public interface UserRepository extends JpaRepository<UserAccount, Long> {
    UserAccount findByMongoId(String mongoId);

    @Transactional
    void deleteByMongoId(String mongoId);
}
