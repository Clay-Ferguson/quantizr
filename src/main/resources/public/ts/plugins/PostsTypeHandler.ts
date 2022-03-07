import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class PostsTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.POSTS, "Posts", "fa-comments-o", true);
    }

    getIconClass(): string {
        return super.getIconClass();
    }

    getEditorHelp(): string {
        return S.quanta?.config?.help?.editor?.dialog;
    }
}
