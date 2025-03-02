package quanta.mongo;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.stereotype.Component;
import quanta.mongo.model.AccountNode;
import quanta.mongo.model.SubNode;

@Component
@ReadingConverter
public class SubNodeConverter implements Converter<Document, SubNode> {
    @SuppressWarnings("unused")
    private static Logger log = LoggerFactory.getLogger(SubNodeConverter.class);

    @Override
    public SubNode convert(Document doc) {
        SubNode node = null;
        switch (doc.getString(SubNode.TYPE)) {
            case "sn:repoRoot":
            case "sn:account":
                node = new AccountNode(doc);
                break;
            default:
                node = new SubNode(doc);
                break;
        }
        MongoUtil.validate(node);
        return node;
    }
}
