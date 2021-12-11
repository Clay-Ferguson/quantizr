import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class MarkdownTypeHandler extends TypeBase {
    constructor() {
        // WARNING: There are places in the code where "Markdown" string is hardcoded.
        super(J.NodeType.NONE, "Markdown", "fa-align-left", true);
    }

    getIconClass(): string {
        return super.getIconClass();
    }

    getEditorHelp(): string {
        return S.quanta?.config?.help?.editor?.dialog;
    }
}
