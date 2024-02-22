import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class CommentType extends TypeBase {
    constructor() {
        super(J.NodeType.COMMENT, "Comment", "fa-comment", true);
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
