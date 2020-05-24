import * as J from "../JavaIntf";
import { Div } from "./Div";
import { Button } from "./Button";
import { TextContent } from "./TextContent";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Heading } from "./Heading";
import { ButtonBar } from "./ButtonBar";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//todo-0: can ListBoxRow be a base class for this?
export class EditPrivsTableRow extends Div {

    constructor(public aclEntry: J.AccessControlInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
        this.setClass("list-group-item list-group-item-action");
    }

    renderAclPrivileges(aclEntry: J.AccessControlInfo): Div {

        let div = new Div();
        aclEntry.privileges.forEach(function(privilege, index) {
            let buttons = new ButtonBar([new Button("Remove", () => {
                this.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
            })], null, "marginBottom");
            div.addChild(buttons);
            div.addChild(new TextContent(aclEntry.principalName + " has privilege " + privilege.privilegeName + " on this node."));
        }, this);
        return div;
    }

    preRender(): void {
        this.setChildren([
            new Heading(4, "User: " + this.aclEntry.principalName),
            this.renderAclPrivileges(this.aclEntry)
        ]);
    }
}
