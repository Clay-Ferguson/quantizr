package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.AIModels;
import quanta.model.client.NodeProp;
import quanta.model.client.NodeType;
import quanta.mongo.model.SubNode;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component 
public class AIAnswerType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.AI_ANSWER.s();
    }

    public String formatExportText(String exportType, SubNode node) {
        String content = node.getContent();
        if (exportType.equalsIgnoreCase("pdf")) {
            String aiService = node.getStr(NodeProp.AI_SERVICE.s());
            if (aiService != null) {
                AIModels svc = AIModels.fromString(aiService);
                if (svc != null) {
                    return aiUtil.formatExportAnswerSection(content, "by AI: " + svc.getDescription());
                }
            }
            return aiUtil.formatExportAnswerSection(content, "by AI");
        } else {
            return content;
        }
    }
}
