package quanta.mongo.model;

import org.springframework.data.annotation.PersistenceCreator;
import org.springframework.data.annotation.TypeAlias;

@TypeAlias("account")
public class AccountNode extends SubNode {

    @PersistenceCreator
    public AccountNode() {
        super();
    }

    public AccountNode(org.bson.Document doc) {
        super(doc);
    }
}
