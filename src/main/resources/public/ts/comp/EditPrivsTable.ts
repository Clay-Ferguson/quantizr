import * as I from "../Interfaces";
import { Div } from "../comp/core/Div";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";
import * as J from "../JavaIntf";

export class EditPrivsTable extends ListBox {

    constructor(public publicChangedFunc: Function, public nodePrivsInfo: I.NodePrivilegesInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);
    }

    preRender(): void {
        let children = [];

        if (this.nodePrivsInfo?.aclEntries) {
            // first add public, so it's at the top
            this.nodePrivsInfo.aclEntries.forEach(function (aclEntry: J.AccessControlInfo) {
                if (aclEntry.principalName?.toLowerCase() === "public") {
                    children.push(new EditPrivsTableRow(this.publicChangedFunc, aclEntry, this.removePrivilege));
                }
            }, this);

            this.nodePrivsInfo.aclEntries.forEach(function (aclEntry) {
                if (aclEntry.principalName?.toLowerCase() !== "public") {
                    children.push(new EditPrivsTableRow(this.publicChangedFunc, aclEntry, this.removePrivilege));
                }
            }, this);
        }

        if (children.length === 0) {
            children.push(new Div("Node is not currently shared, but may be accessible via any shared parents."));
        }

        this.setChildren(children);
    }
}
