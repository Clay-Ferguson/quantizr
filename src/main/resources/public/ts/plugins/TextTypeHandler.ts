import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

/* Type for 'untyped' types. That is, if the user has not set a type explicitly this type will be the default */
export class TextTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.PLAIN_TEXT, "Text", "fa-file-text", true);
    }
}
