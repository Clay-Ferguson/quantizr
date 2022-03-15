import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { NodeActionType } from "../enums/NodeActionType";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class RoomTypeHandler extends TypeBase {
    static helpExpanded: boolean;

    constructor() {
        super(J.NodeType.ROOM, "Chat Room", "fa-comments", true);
    }

    // getEditorHelp(): string {
    //     return S.quanta?.config?.help?.type?.friend?.editor;
    // }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let baseComp = super.render(node, tabData, rowStyling, isTreeView, state);
        return new Div(null, null, [
            baseComp,
            new ButtonBar([
                new Button("View Room Feed", () => {
                    S.nav.openNodeFeed(null, node.id);
                }, null, "btn-primary")
            ], "marginLeft systemNodeContent marginBottom")
        ]);
    }
}
