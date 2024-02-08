package quanta.types;

import org.springframework.stereotype.Component;
import quanta.model.client.NodeType;

// IMPORTANT: See TypePluginMgr, and ServiceBase instantiation to initialize tyese Plugin types
@Component
public class GeminiAIAnswerType extends TypeBase {

    @Override
    public String getName() {
        return NodeType.GEMINIAI_ANSWER.s();
    }

    public String formatExportText(String exportType, String content) {
        if (exportType.equalsIgnoreCase("pdf")) {
            return "<div style='border-radius: 8px; border: 2px solid gray; padding: 8px; margin: 8px;'>\n" + content
                    + "\n<div style='text-align: right; margin: 6px;'>by AI</div></div>";
        } else {
            return content;
        }
    }
}
