import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { NodeActionType } from "../enums/NodeActionType";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class AccountTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.ACCOUNT, "Account Root", "fa-database", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
        case NodeActionType.editNode:
            return false;
        default:
            return true;
        }
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, tabData: TabDataIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, {
            className: "clickable marginAll",
            onClick: (evt: any) => {
                new UserProfileDlg(node.ownerId, state).open();
            }
        }, [
            new Heading(4, "User: " + node.owner)
        ]);
    }
}
