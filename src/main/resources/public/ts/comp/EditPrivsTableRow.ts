import { Button } from "../comp/core//Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Checkbox } from "./core/Checkbox";
import { Icon } from "./core/Icon";
import { ListBoxRow } from "./ListBoxRow";

export class EditPrivsTableRow extends ListBoxRow {

    constructor(private shareNodeToUserFunc: Function, public aclEntry: J.AccessControlInfo, private removePrivilege: (principalNodeId: string, privilege: string) => void) {
        super();
    }

    renderAclPrivileges(aclEntry: J.AccessControlInfo): Div {
        const writable = S.props.hasPrivilege(this.aclEntry, J.PrivilegeType.WRITE);
        const div = new Div(null, { className: "float-end tinyMarginAll" });

        aclEntry.privileges.forEach(privilege => {
            div.addChild(
                new Div(null, null, [
                    new ButtonBar([
                        new Checkbox("Allow Replies", { className: "marginRight" }, {
                            setValue: (checked: boolean) => this.shareNodeToUserFunc(this.aclEntry.principalName, checked),
                            getValue: (): boolean => writable
                        }),
                        new Button("Remove", () => {
                            this.removePrivilege(aclEntry.principalNodeId, privilege.privilegeName);
                        })
                    ], "marginLeft")
                ])
            );
        });
        return div;
    }

    preRender(): void {
        let src: string = null;
        if (this.aclEntry.avatarVer) {
            src = S.render.getAvatarImgUrl(this.aclEntry.principalNodeId, this.aclEntry.avatarVer);
        }
        // foreign users have this kind of avatar
        else if (this.aclEntry.foreignAvatarUrl) {
            src = this.aclEntry.foreignAvatarUrl;
        }

        const displayName = this.aclEntry.displayName
            ? this.aclEntry.displayName + " (@" + this.aclEntry.principalName + ")"
            : ("@" + this.aclEntry.principalName);

        const isPublic = this.aclEntry.principalName === J.PrincipalName.PUBLIC;

        this.setChildren([
            new Div(null, null, [
                new Div(null, { className: "friendListImgDivCont" }, [
                    !isPublic ? new Div(null, { className: "friendListImgDiv centerChild" }, [
                        src ? new Img({
                            className: "friendListImage",
                            src,
                            onClick: () => {
                                new UserProfileDlg(this.aclEntry.principalNodeId).open();
                            }
                        }) : null
                    ]) : null,
                    isPublic ? new Div(null, { className: "friendListImgDiv centerChild" }, [
                        new Icon({
                            className: "fa fa-globe fa-3x sharingIcon marginAll",
                            title: "Node is Public"
                        })
                    ]) : null
                ]),
                // todo-1: I tried for 30min to get spacing to show up at bottom of of 'sharingDisplayName'
                // and failed. welp, I guess I'm done on that for a minute. I must be missing something.
                isPublic ? new Div("Public (Everyone)", { className: "largeFont sharingDisplayName" })
                    : new Div(displayName, {
                        className: "sharingDisplayName",
                        onClick: () => {
                            new UserProfileDlg(this.aclEntry.principalNodeId).open();
                        }
                    }),
                this.renderAclPrivileges(this.aclEntry)
            ])
        ]);
    }
}
