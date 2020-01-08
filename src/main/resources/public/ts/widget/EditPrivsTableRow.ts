import { Comp } from "./base/Comp";
import * as I from "../Interfaces";
import { Div } from "./Div";
import { SharingDlg } from "../dlg/SharingDlg";
import { Button } from "./Button";
import { TextContent } from "./TextContent";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { Heading } from "./Heading";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditPrivsTableRow extends Comp {

    constructor(public sharingDlg: SharingDlg, public aclEntry: I.AccessControlEntryInfo) {
        super(null);
        this.setClass("list-group-item list-group-item-action");
        this.addChild(new Heading(4, "User: " + aclEntry.principalName));

        let privElementsDiv = new Div();
        this.renderAclPrivileges(privElementsDiv, aclEntry);
        this.addChild(privElementsDiv);
    }

    renderAclPrivileges = (div: Div, aclEntry: I.AccessControlEntryInfo): void => {

        aclEntry.privileges.forEach( (privilege, index) => {
            let removeButton = new Button("Remove", () => {
                this.sharingDlg.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
            })
            div.addChild(removeButton);
            div.addChild(new TextContent("<b>" + aclEntry.principalName + "</b> has privilege <b>" + privilege.privilegeName + "</b> on this node.",
                "privilege-entry"));
        });
    }

    compRender = (): ReactNode => {
        return this.tagRender('div', null, this.attribs);
    }
}
