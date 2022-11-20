import { Div } from "../comp/core/Div";
import * as J from "../JavaIntf";
import { AccessControlInfo } from "../JavaIntf";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";

export class EditPrivsTable extends ListBox {

    // todo-0: shareNodeToUserFunc not used?
    constructor(public shareNodeToUserFunc: Function, public acl: AccessControlInfo[]) {
        super(null);
    }

    preRender(): void {
        const children = [];

        if (this.acl) {
            // first add public, so it's at the top
            this.acl.forEach((aclEntry: J.AccessControlInfo) => {
                if (aclEntry.principalName?.toLowerCase() === "public") {
                    children.push(new EditPrivsTableRow(aclEntry));
                }
            }, this);

            this.acl.forEach((aclEntry: J.AccessControlInfo) => {
                if (aclEntry.principalName?.toLowerCase() !== "public") {
                    children.push(new EditPrivsTableRow(aclEntry));
                }
            }, this);
        }

        if (children.length === 0) {
            children.push(new Div("Node is not currently shared. Add people or make it public to share."));
        }

        this.setChildren(children);
    }
}
