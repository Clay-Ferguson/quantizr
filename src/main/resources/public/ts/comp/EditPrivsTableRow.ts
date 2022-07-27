import { getAppState } from "../AppRedux";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Button } from "../comp/core//Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Img } from "../comp/core/Img";
import { ListBoxRow } from "./ListBoxRow";
import { Span } from "../comp/core/Span";
import { Checkbox } from "./core/Checkbox";

export class EditPrivsTableRow extends ListBoxRow {

    constructor(private publicChangedFunc: Function, public aclEntry: J.AccessControlInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
    }

    renderAclPrivileges(aclEntry: J.AccessControlInfo): Div {
        let div = new Div(null, { className: "float-end microMarginBottom" });

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
                onClick: () => {
                    new UserProfileDlg(this.aclEntry.principalNodeId, getAppState(null)).open();
                }
            });
        }

        let displayName = this.aclEntry.displayName
            ? this.aclEntry.displayName + " (@" + this.aclEntry.principalName + ")"
            : ("@" + this.aclEntry.principalName);

        let isPublic = this.aclEntry.principalName === "public";
        let publicWritable = S.props.hasPrivilege(this.aclEntry, J.PrivilegeType.WRITE);

        this.setChildren([
            new Div(null, { className: "microMarginAll" }, [
                this.renderAclPrivileges(this.aclEntry),
                img,
                isPublic
                    ? new Heading(5, "Public")
                    : new Span(displayName, {
                        className: "clickable " + (img ? "marginLeft" : ""),
                        onClick: (evt: any) => {
                            new UserProfileDlg(this.aclEntry.principalNodeId, getAppState(null)).open();
                        }
                    }),
                isPublic
                    ? new Checkbox("Allow Replies", { className: "marginLeft" }, {
                        setValue: (checked: boolean) => {
                            this.publicChangedFunc(checked);
                        },
                        getValue: (): boolean => {
                            return publicWritable;
                        }
                    }) : null
            ])
        ]);
    }
}
