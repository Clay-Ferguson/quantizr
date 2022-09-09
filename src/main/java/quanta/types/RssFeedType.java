package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

@Component
public class RssFeedType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.RSS_FEED.s();
    }
}
