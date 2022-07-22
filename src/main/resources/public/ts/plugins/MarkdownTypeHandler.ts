import { store } from "../AppRedux";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class MarkdownTypeHandler extends TypeBase {
    constructor() {
        // WARNING: There are places in the code where "Markdown" string is hardcoded.
        super(J.NodeType.NONE, "Markdown", "fa-align-left", true);
    }

    getEditorHelp(): string {
        let state = store.getState();
        return state.config?.help?.editor?.dialog;
    }
}
