import * as I from "../Interfaces";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { Heading } from "./Heading";
import { ListBox } from "./ListBox";

export class EditPrivsTable extends ListBox {

    constructor(public nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);
    }

    preRender(): void {
        let children = [];

        if (this.nodePrivsInfo && this.nodePrivsInfo.aclEntries) {
            this.nodePrivsInfo.aclEntries.forEach(function (aclEntry) {
                children.push(new EditPrivsTableRow(aclEntry, this.removePrivilege));
            }, this);
        }

        if (children.length === 0) {
            children.push(new Heading(4, "Node is not currently shared, but may be accessible via any shared parents."));
        }

        this.setChildren(children);
    }
}
