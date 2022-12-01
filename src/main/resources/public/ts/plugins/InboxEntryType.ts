import { AppState } from "../AppState";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class InboxEntryType extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX_ENTRY, "Notification", "fa-envelope", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, ast: AppState): boolean {
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

    allowPropertyEdit(propName: string, ast: AppState): boolean {
        return false;
    }
}
