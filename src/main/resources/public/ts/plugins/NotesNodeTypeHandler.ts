import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TypeBase } from "./base/TypeBase";
import { TabIntf } from "../intf/TabIntf";

export class NotesNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.NOTES, "Notes", "fa-sticky-note", false);
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp => {
        return new Div(null, null, [
            new Heading(4, "Notes", {
                className: "marginAll"
            })
        ]);
    }
}
