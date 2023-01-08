import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class RoomType extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.ROOM, "Chat Room", "fa-comments", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, ast: AppState): boolean {
        return true;
    }

    super_render = this.render;
    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {
        const baseComp = this.super_render(node, tabData, rowStyling, isTreeView, isLinkedNode, ast);
        return new Div(null, null, [
            baseComp,
            new ButtonBar([
                new Button("View Room Feed", () => {
                    S.nav.openNodeFeed(null, node.id);
                }, null, "btn-primary")
            ], "marginLeft")
        ]);
    }
}
