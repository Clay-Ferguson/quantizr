import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class InboxEntryType extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX_ENTRY, "Notification", "fa-envelope", false);
    }

    override allowAction(action: NodeActionType, _node: NodeInfo): boolean {
        switch (action) {
            case NodeActionType.delete:
                return true;
            default:
                return false;
        }
    }

    override getAllowPropertyAdd(): boolean {
        return false;
    }

    override getAllowContentEdit(): boolean {
        return false;
    }

    override allowPropertyEdit(_propName: string): boolean {
        return false;
    }
}
