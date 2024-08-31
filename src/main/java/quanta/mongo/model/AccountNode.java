package quanta.mongo.model;

import org.springframework.data.annotation.TypeAlias;

@TypeAlias("account")
public class AccountNode extends SubNode {
    public AccountNode(org.bson.Document doc) {
        super(doc);
    }
}
