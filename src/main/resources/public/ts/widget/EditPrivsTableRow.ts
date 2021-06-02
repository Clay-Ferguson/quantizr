import { appState } from "../AppRedux";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { Heading } from "./Heading";
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
        let div = new Div(null, { className: "float-right marginBottom" });

        aclEntry.privileges.forEach(function (privilege, index) {
            div.addChild(
                new Div(null, null, [
                    new Span(privilege.privilegeName),
                    new ButtonBar([
                        new Button("Remove", () => {
                            this.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
                        })
                    ], "marginLeft")
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

        if (src) {
            img = new Img(null, {
                className: "friendListImage",
                src: src,
                onClick: (evt: any) => {
                    new UserProfileDlg(this.aclEntry.principalNodeId, appState(null)).open();
                }
            });
        }

        let displayName = this.aclEntry.displayName
            ? this.aclEntry.displayName + " (@" + this.aclEntry.principalName + ")"
            : ("@" + this.aclEntry.principalName);

        this.setChildren([
            new Div(null, { className: "marginAll" }, [
                img,
                this.aclEntry.principalName === "public"
                    ? new Heading(4, "Public")
                    : new Span(displayName, { className: img ? "marginLeft" : "" }),
                this.aclEntry.principalName === "public"
                    ? new Span("Visible to everyone.")
                    : null,
                this.renderAclPrivileges(this.aclEntry)
            ])
        ]);
    }
}
