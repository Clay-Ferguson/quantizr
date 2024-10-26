import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class BookmarkListType extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK_LIST, "Bookmarks", "fa-bookmark", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return false;
    }

    override render = (_node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, this.displayName),
            new Div("Delete, edit, or order your bookmarks here.", { className: "ml-3" })
        ]);
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override subOrdinal(): number {
        return 1;
    }
}
