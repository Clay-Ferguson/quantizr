import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class NotesNodeType extends TypeBase {
    constructor() {
        super(J.NodeType.NOTES, "Notes", "fa-sticky-note", false);
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override render = (_node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Notes", { className: "noMargin" })
        ]);
    }
}
