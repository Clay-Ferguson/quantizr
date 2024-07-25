package quanta.postgres.table;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_accnt")
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Adding 'unique = true' to the @Column annotation will make the column
    // be defined as unique in the database.
    @Column(name = "mongo_id", nullable = false, unique = true)
    private String mongoId;

    @Column(name = "user_name", nullable = false, unique = true)
    private String userName;

    @OneToMany(mappedBy = "userAccount", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Tran> trans;

    public UserAccount() {
        // JPA requires a default constructor
    }

    public UserAccount(String mongoId, String userName) {
        this.mongoId = mongoId;
        this.userName = userName;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMongoId() {
        return mongoId;
    }

    public void setMongoId(String mongoId) {
        this.mongoId = mongoId;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    @JsonIgnore
    public List<Tran> getTrans() {
        return trans;
    }

    @JsonIgnore
    public void setTrans(List<Tran> trans) {
        this.trans = trans;
    }
}
