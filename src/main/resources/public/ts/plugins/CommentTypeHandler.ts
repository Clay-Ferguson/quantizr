import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class CommentTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.COMMENT, "Comment", "fa-comment", true);
    }

    getExtraMarkdownClass(): string {
        return "commentMarkdownClass";
    }
}
