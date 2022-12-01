import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TypeBase } from "./base/TypeBase";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";

export class BookmarkListType extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK_LIST, "Bookmarks", "fa-bookmark", false);
    }

    getAllowRowHeader(): boolean {
        return false;
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, ast: AppState): boolean {
        return false;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, this.displayName, {
                className: "marginAll"
            }),
            new Div("Delete, edit, or order your bookmarks here.", { className: "marginLeft marginBottom" })
        ]);
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 1;
    }
}
