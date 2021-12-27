import * as I from "../Interfaces";
import { Div } from "../comp/core/Div";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";

export class EditPrivsTable extends ListBox {

    constructor(public publicChangedFunc: Function, public nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);
    }

    preRender(): void {
        let children = [];

        if (this.nodePrivsInfo && this.nodePrivsInfo.aclEntries) {
            this.nodePrivsInfo.aclEntries.forEach(function (aclEntry) {
                children.push(new EditPrivsTableRow(this.publicChangedFunc, aclEntry, this.removePrivilege));
            }, this);
        }

        if (children.length === 0) {
            children.push(new Div("Node is not currently shared, but may be accessible via any shared parents."));
        }

        this.setChildren(children);
    }
}
