import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

export class NotesNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.NOTES, "Notes", "fa-sticky-note", false);
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new Heading(4, "Notes", {
                className: "marginAll"
            })
        ]);
    }
}
