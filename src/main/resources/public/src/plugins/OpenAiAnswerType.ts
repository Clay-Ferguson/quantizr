import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { TypeBase } from "./base/TypeBase";

export class OpenAiAnswerType extends TypeBase {
    constructor() {
        super(J.NodeType.OPENAI_ANSWER, "AI Answer (OpenAI)", "fa-android", false);
    }

    // For now i'm not sure how we should indicate visibly that a
    // node is a comment, so I'm just not doing it, but this code DOES work.
    override getExtraMarkdownClass(): string {
        return "aiAnswer";
    }

    override getCustomFooter(node: NodeInfo): Div {
        return S.aiUtil.getAiNodeFooter("by OpenAI", node);
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

    // super_render = this.render;
    // override render = (node: NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean): Comp => {
    //     const baseComp = this.super_render(node, tabData, rowStyling, isTreeView);
    //     return new Div(null, null, [
    //         baseComp,
    //         new Span("More Questions?")
    //     ]);
    // }
}
