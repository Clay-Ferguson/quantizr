import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { FriendsDlg } from "../dlg/FriendsDlg";
import { SearchUsersDlg } from "../dlg/SearchUsersDlg";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class FriendsListType extends TypeBase {
    constructor() {
        super(J.NodeType.FRIEND_LIST, "Follows", "fa-users", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return false;
    }

    override render = (_node: NodeInfo, _tabData: TabIntf<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Follows"),
            new Div("These are the people you follow. Delete from this list to unfollow.", { className: "marginAll" }),
            new Button("Follow Someone", () => {
                new SearchUsersDlg().open();
            }, null, "btn-primary"),
            new Button("Search Follows", () => {
                const friendsDlg = new FriendsDlg("Follows", null, true);
                friendsDlg.open();
            }, null, "btn-primary")
        ]);
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override subOrdinal(): number {
        return 2;
    }
}
