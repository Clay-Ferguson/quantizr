import * as J from "../JavaIntf";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Heading } from "./Heading";
import { HorizontalLayout } from "./HorizontalLayout";
import { ListBoxRow } from "./ListBoxRow";
import { Span } from "./Span";

// let S: Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

export class EditPrivsTableRow extends ListBoxRow {

    constructor(public aclEntry: J.AccessControlInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
    }

    renderAclPrivileges(aclEntry: J.AccessControlInfo): Div {
        let div = new Div();

        aclEntry.privileges.forEach(function (privilege, index) {
            div.addChild(
                new HorizontalLayout([
                    new Span(privilege.privilegeName),
                    new ButtonBar([
                        new Button("Remove", () => {
                            this.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
                        })
                    ], null, "float-right")
                ], "marginAll")
            );
        }, this);

        return div;
    }

    preRender(): void {
        this.setChildren([
            new Heading(5, this.aclEntry.principalName),
            this.renderAclPrivileges(this.aclEntry)
        ]);
    }
}
