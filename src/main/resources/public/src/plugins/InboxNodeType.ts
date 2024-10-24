import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { FlexRowLayout } from "../comp/core/FlexRowLayout";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class InboxNodeType extends TypeBase {
    constructor() {
        super(J.NodeType.INBOX, "Inbox", "fa-inbox", false);
    }

    override allowAction(_action: NodeActionType, _node: NodeInfo): boolean {
        return false;
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

    override render = (_node: NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new FlexRowLayout([
            new Heading(4, "Inbox"),
            new ButtonBar([
                new Button("Clear Inbox", () => S.edit.clearInbox())
            ], null, "tw-float-right marginBottom"),
            new Clearfix()
        ], "systemNodeContent");
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override subOrdinal(): number {
        return 3;
    }
}
