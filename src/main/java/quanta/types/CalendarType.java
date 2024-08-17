package quanta.types;

import java.util.Calendar;
import org.springframework.stereotype.Component;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;
import quanta.util.val.Val;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component 
public class CalendarType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.CALENDAR.s();
    }

    public void childCreated(Val<SubNode> node, Val<SubNode> childNode) {
        if (NodeType.CALENDAR.s().equals(node.getVal().getType())) {
            // if parent is a calendar node, then we need to set the date on this new node
            childNode.getVal().set(NodeProp.DATE, Calendar.getInstance().getTime().getTime());
            childNode.getVal().set(NodeProp.DURATION, "01:00");
            // childNode.getVal().setTags("#due");
        }
    }
}
