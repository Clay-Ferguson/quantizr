package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component
public class OpenAIAnswerType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.OPENAI_ANSWER.s();
    }

    public String formatExportText(String exportType, String content) {
        if (exportType.equalsIgnoreCase("pdf")) {
            return aiUtil.formatExportAnswerSection(content, "by OpenAI");
        } else {
            return content;
        }
    }
}
