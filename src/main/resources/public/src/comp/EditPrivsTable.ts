import { AccessControlInfo, PrincipalName } from "../JavaIntf";
import { TextContent } from "./core/TextContent";
import { EditPrivsTableRow } from "./EditPrivsTableRow";
import { ListBox } from "./ListBox";

export class EditPrivsTable extends ListBox {

    constructor(public shareNodeToUserFunc: (userName: string, allowAppends: boolean) => void, public acl: AccessControlInfo[], private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super(null);

        const maxHeight: number = window.innerHeight > 300 ? (window.innerHeight * 0.5) : 300;
        this.attribs.className = "scrollY privsTable scrollBorder customScrollbar mb-3";
        this.attribs.style = { maxHeight: maxHeight + "px" };
    }

    override preRender(): boolean | null {
        const children = [];

        if (this.acl) {
            // first add public, so it's at the top
            this.acl.forEach(aclEntry => {
                if (aclEntry.principalName?.toLowerCase() === PrincipalName.PUBLIC) {
                    children.push(new EditPrivsTableRow(this.shareNodeToUserFunc, aclEntry, this.removePrivilege));
                }
            });

            this.acl.forEach(aclEntry => {
                if (aclEntry.principalName?.toLowerCase() !== PrincipalName.PUBLIC) {
                    children.push(new EditPrivsTableRow(this.shareNodeToUserFunc, aclEntry, this.removePrivilege));
                }
            });
        }

        if (children.length === 0) {
            this.attribs.className = null;
            children.push(new TextContent("Node is not currently shared. Add people or make it public to share."));
        }

        this.children = children;
        return true;
    }
}
