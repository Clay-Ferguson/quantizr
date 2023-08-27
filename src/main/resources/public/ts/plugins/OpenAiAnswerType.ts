import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class OpenAiAnswerType extends TypeBase {
    constructor() {
        super(J.NodeType.OPENAI_ANSWER, "AI Answer", "fa-android", true);
    }

    // For now i'm not sure how we should indicate visibly that a
    // node is a comment, so I'm just not doing it, but this code DOES work.
    override getExtraMarkdownClass(): string {
        return "openAiAnswer";
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true,
            nodeName: true,
            priority: true,
            wordWrap: true,
            encrypt: true,
            sign: true,
            inlineChildren: true
        };
    }
}
