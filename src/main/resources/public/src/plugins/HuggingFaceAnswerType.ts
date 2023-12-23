import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { Div } from "../comp/core/Div";
import { TypeBase } from "./base/TypeBase";

export class HuggingFaceAnswerType extends TypeBase {
    constructor() {
        super(J.NodeType.HUGGINGFACE_ANSWER, "AI Answer", "fa-android", false);
    }

    // For now i'm not sure how we should indicate visibly that a
    // node is a comment, so I'm just not doing it, but this code DOES work.
    override getExtraMarkdownClass(): string {
        return "aiAnswer";
    }

    override getCustomFooter(): Div {
        return new Div("by Open Source AI", { className: "aiAnswerFooter float-end" });
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true,
            nodeName: true,
            priority: true,
            wordWrap: true,
            encrypt: true,
            sign: true
        };
    }

    // super_render = this.render;
    // override render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean): Comp => {
    //     const baseComp = this.super_render(node, tabData, rowStyling, isTreeView, isLinkedNode);
    //     return new Div(null, null, [
    //         baseComp,
    //         new Span("More Questions?")
    //     ]);
    // }
}
