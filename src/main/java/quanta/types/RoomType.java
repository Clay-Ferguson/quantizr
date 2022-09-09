package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

@Component
public class RoomType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.ROOM.s();
    }
}
