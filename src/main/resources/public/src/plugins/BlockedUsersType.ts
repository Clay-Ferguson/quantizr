import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class BlockedUsersType extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.BLOCKED_USERS, "Blocked Users", "fa-ban", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return false;
    }

    override render = (_node: NodeInfo, _tabData: TabIntf<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, this.displayName),
            new Div("These are the people you've blocked. Delete from this list to unblock.", { className: "marginLeft" })
        ]);
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override subOrdinal(): number {
        return 4;
    }
}
