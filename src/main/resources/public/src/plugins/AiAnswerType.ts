import { AIService } from "../AIUtil";
import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { TypeBase } from "./base/TypeBase";

export class AiAnswerType extends TypeBase {
    constructor() {
        super(J.NodeType.AI_ANSWER, "AI Answer", "fa-robot", false);
    }

    // For now i'm not sure how we should indicate visibly that a node is a comment, so I'm just not
    // doing it, but this code DOES work.
    override getExtraMarkdownClass(): string {
        return "aiAnswer";
    }

    override getCustomFooter(node: NodeInfo): Div {
        const aiService: AIService = S.aiUtil.getServiceByName(S.props.getPropStr(J.NodeProp.AI_SERVICE, node));
        if (aiService) {
            return S.aiUtil.getAiNodeFooter("by AI - " + aiService.description, node);
        }
        else {
            return S.aiUtil.getAiNodeFooter("by AI", node);
        }
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true,
            nodeName: true,
            priority: true,
            wordWrap: true,
            encrypt: true,
        };
    }
}
