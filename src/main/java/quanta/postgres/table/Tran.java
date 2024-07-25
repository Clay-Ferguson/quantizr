package quanta.postgres.table;

import java.math.BigDecimal;
import java.sql.Timestamp;
import org.hibernate.annotations.Type;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "tran")
public class Tran {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount userAccount;

    @Column(name = "amt")
    private BigDecimal amt;

    @Column(name = "ts", nullable = false)
    private Timestamp ts;

    @Column(name = "tran_type")
    private String transType;

    @Column(name = "desc_code")
    private String descCode;

    @Type(JsonBinaryType.class)
    @Column(name = "detail", columnDefinition = "jsonb")
    private JsonNode detail;

    public Tran() {
        // JPA requires a default constructor
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    @JsonIgnore
    public UserAccount getUserAccount() {
        return userAccount;
    }

    @JsonIgnore
    public void setUserAccount(UserAccount userAccount) {
        this.userAccount = userAccount;
    }

    public BigDecimal getAmt() {
        return amt;
    }

    public void setAmt(BigDecimal amt) {
        this.amt = amt;
    }

    public Timestamp getTs() {
        return ts;
    }

    public void setTs(Timestamp ts) {
        this.ts = ts;
    }

    public String getTransType() {
        return transType;
    }

    public void setTransType(String transType) {
        this.transType = transType;
    }

    public String getDescCode() {
        return descCode;
    }

    public void setDescCode(String descCode) {
        this.descCode = descCode;
    }

    @JsonIgnore
    public JsonNode getDetail() {
        return detail;
    }

    @JsonIgnore
    public void setDetail(JsonNode detail) {
        this.detail = detail;
    }
}
