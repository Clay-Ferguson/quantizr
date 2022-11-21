import { Div } from "../comp/core/Div";
import { AccessControlInfo } from "../JavaIntf";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";

export class EditPrivsTable extends ListBox {

    constructor(public shareNodeToUserFunc: Function, public acl: AccessControlInfo[], private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);
    }

    preRender(): void {
        const children = [];

        if (this.acl) {
            // first add public, so it's at the top
            this.acl.forEach(aclEntry => {
                if (aclEntry.principalName?.toLowerCase() === "public") {
                    children.push(new EditPrivsTableRow(this.shareNodeToUserFunc, aclEntry, this.removePrivilege));
                }
            });

            this.acl.forEach(aclEntry => {
                if (aclEntry.principalName?.toLowerCase() !== "public") {
                    children.push(new EditPrivsTableRow(this.shareNodeToUserFunc, aclEntry, this.removePrivilege));
                }
            });
        }

        if (children.length === 0) {
            children.push(new Div("Node is not currently shared. Add people or make it public to share."));
        }

        this.setChildren(children);
    }
}
