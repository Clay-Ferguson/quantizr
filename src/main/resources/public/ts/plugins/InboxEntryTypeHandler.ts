import { AppState } from "../AppState";
import { NodeCompMarkdown } from "../comps/NodeCompMarkdown";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class InboxEntryTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX_ENTRY, "Inbox Entry", "fa-envelope", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
            case NodeActionType.delete:
                return true;
            default:
                return false;
        }
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return false;
    }

    // render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
    //     return new Div(null, null, [
    //         new NodeCompMarkdown(node, state),
    //         new Div(null, { className: "marginLeft" }, [
    //             new Icon({
    //                 title: "Reply",
    //                 className: "fa fa-comment fa-lg rowFooterIcon",
    //                 onClick: () => S.edit.addNode(node, null, state)
    //             })
    //         ])
    //     ]);
    // }
}
