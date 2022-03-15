import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { NodeActionType } from "../enums/NodeActionType";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class BlockedUsersTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.BLOCKED_USERS, "Blocked Users", "fa-ban", false);
    }

    getAllowRowHeader(): boolean {
        return false;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, this.displayName, {
                className: "marginAll"
            }),
            new Div("These are the people you've blocked. Delete from this list to unblock the person.", { className: "marginLeft marginBottom" })
        ]);
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 4;
    }
}
