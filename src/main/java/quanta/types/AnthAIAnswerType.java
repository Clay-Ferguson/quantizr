package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

/** Anthropic AI Answer */
// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component
public class AnthAIAnswerType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.ANTHAI_ANSWER.s();
    }

    public String formatExportText(String exportType, String content) {
        if (exportType.equalsIgnoreCase("pdf")) {
            return aiUtil.formatExportAnswerSection(content, "by Anthropic AI");
        } else {
            return content;
        }
    }
}
