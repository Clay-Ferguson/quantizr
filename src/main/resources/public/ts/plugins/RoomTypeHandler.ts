import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let baseComp = super.render(node, rowStyling, isTreeView, state);
        return new Div(null, null, [
            baseComp,
            new ButtonBar([
                new Button("Join Room", () => {
                    S.nav.openNodeFeed(null, node.id);
                }, null, "btn-primary")
            ], "marginLeft marginBottom")
        ]);
    }
}
