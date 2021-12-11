import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Clearfix } from "../comp/Clearfix";
import { Heading } from "../comp/Heading";
import { HorizontalLayout } from "../comp/HorizontalLayout";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";
export class InboxNodeTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX, "Inbox", "fa-inbox", false);
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

    render(node: J.NodeInfo, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        return new HorizontalLayout([
            new Heading(4, "Inbox"),
            new ButtonBar([
                new Button("Clear Inbox", () => {
                    S.edit.clearInbox(state);
                })
            ], null, "float-end marginBottom"),
            new Clearfix()
        ], "displayTable marginAll");
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 3;
    }
}
