import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class NotesNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.NOTES, "Notes", "fa-sticky-note", false);
    }
}
