import { AppState } from "../AppState";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

// let S: Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

export class InboxEntryTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX_ENTRY, "Inbox Entry", "fa-envelope", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return false;
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
}
