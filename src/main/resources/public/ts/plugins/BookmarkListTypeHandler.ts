import { AppState } from "../AppState";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { TypeBase } from "./base/TypeBase";

export class BookmarkListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK_LIST, "Bookmark List", "fa-bookmark", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new Div(null, null, [
            new Heading(4, this.displayName, {
                className: "marginAll"
            })
        ]);
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 1;
    }
}
