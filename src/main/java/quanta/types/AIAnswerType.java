package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component
public class AIAnswerType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.AI_ANSWER.s();
    }

    public String formatExportText(String exportType, String content) {
        if (exportType.equalsIgnoreCase("pdf")) {
            // todo-0: need to implement ACTUAL service not just generally "AI" here
            return aiUtil.formatExportAnswerSection(content, "by AI");
        } else {
            return content;
        }
    }
}
