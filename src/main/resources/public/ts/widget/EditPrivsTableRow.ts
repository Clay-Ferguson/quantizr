import { appState } from "../AppRedux";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Heading } from "./Heading";
import { HorizontalLayout } from "./HorizontalLayout";
import { Img } from "./Img";
import { ListBoxRow } from "./ListBoxRow";
import { Span } from "./Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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
                    ], null, "float-right marginBottom")
                ])
            );
        }, this);
        return div;
    }

    preRender(): void {
        // console.log("aclEntry: " + S.util.prettyPrint(aclEntry));
        let src: string = null;
        if (this.aclEntry.avatarVer) {
            src = S.render.getAvatarImgUrl(this.aclEntry.principalNodeId, this.aclEntry.avatarVer);
        }
        let img: Img = null;
        let state = appState(null);

        if (src) {
            img = new Img(null, {
                className: "friendListImage",
                src: src,
                onClick: (evt: any) => {
                    // new ProfileDlg(state, true, this.aclEntry.principalNodeId, this.aclEntry.principalName).open();
                    S.meta64.userProfileView.open(true, this.aclEntry.principalNodeId);
                }
            });
        }

        this.setChildren([
            new Div(null, { className: "marginAll" }, [
                img,
                this.aclEntry.principalName === "public"
                    ? new Heading(3, "Public")
                    : new Span(this.aclEntry.principalName, { className: img ? "marginLeft" : "" }),
                this.aclEntry.principalName === "public"
                    ? new Span("Visible to everyone.")
                    : null,
                this.renderAclPrivileges(this.aclEntry)
            ])
        ]);
    }
}
