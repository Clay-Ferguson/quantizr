import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Heading } from "../comp/core/Heading";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class InboxNodeType extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX, "Inbox", "fa-inbox", false);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo): boolean {
        return false;
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

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {
        return new HorizontalLayout([
            new Heading(4, "Inbox", { className: "noMargin" }),
            new ButtonBar([
                new Button("Clear Inbox", () => S.edit.clearInbox())
            ], null, "float-end marginBottom"),
            new Clearfix()
        ], "displayTable systemNodeContent");
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    subOrdinal(): number {
        return 3;
    }
}
