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
        let div = new Div(null, { className: "float-end marginBottom" });

        aclEntry.privileges.forEach(function (privilege, index) {
            div.addChild(
                new Div(null, null, [
                    // new Span(privilege.privilegeName), don't need this it's just "rd/wr"
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
        // console.log("aclEntry: " + S.util.prettyPrint(this.aclEntry));
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

        let isPublic = this.aclEntry.principalName === "public";
        let publicWritable = S.props.hasPrivilege(this.aclEntry, J.PrivilegeType.WRITE);
        let descript = "";
        if (isPublic) {
            if (publicWritable) {
                descript = "Visible to everyone. Anyone can reply.";
            }
            else {
                descript = "Visible to everyone. (NO REPLIES ALLOWED)";
            }
        }

        this.setChildren([
            new Div(null, { className: "marginAll" }, [
                img,
                isPublic
                    ? new Heading(4, "Public")
                    : new Span(displayName, { className: img ? "marginLeft" : "" }),
                descript
                    ? new Span(descript)
                    : null,
                this.renderAclPrivileges(this.aclEntry)
            ])
        ]);
    }
}
