import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Span } from "../comp/core/Span";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { FriendInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Checkbox } from "./core/Checkbox";
import { ListBoxRow } from "./ListBoxRow";

export class FriendsTableRow extends ListBoxRow {

    constructor(public friend: FriendInfo, private dlg: CompIntf) {
        super(null, null, null);
    }

    preRender(): void {
        let src: string = null;

        // local users will have this kind of avatar
        if (this.friend.avatarVer) {
            src = S.render.getAvatarImgUrl(this.friend.userNodeId, this.friend.avatarVer);
        }
        // foreign users have this kind of avatar
        else if (this.friend.foreignAvatarUrl) {
            src = this.friend.foreignAvatarUrl;
        }
        else {
            console.log("no avatarVer on friend: " + this.friend.userNodeId);
        }

        let img: Img = null;
        if (src) {
            img = new Img(null, {
                className: "friendListImage",
                src: src,
                onClick: () => new UserProfileDlg(this.friend.userNodeId).open()
            });
        }

        const friendDisplay = this.friend.displayName
            ? this.friend.displayName + " (@" + this.friend.userName + ")"
            : ("@" + this.friend.userName);

        this.setChildren([
            new Div(null, null, [
                new Checkbox(null, { className: "marginLeft" }, {
                    setValue: (checked: boolean) => {
                        // todo-1: add typesafety here (would need FriendsDlg LS to be in separate interfaces, to avoid circular ref)
                        const state: any = this.dlg.getState();
                        if (checked) {
                            state.selections.add(this.friend.userName);
                        }
                        else {
                            state.selections.delete(this.friend.userName);
                        }
                        this.dlg.mergeState(state);
                    },
                    getValue: (): boolean => this.dlg.getState().selections.has(this.friend.userName)
                }),
                img,
                new Span(friendDisplay, { className: "friendListText" })
            ])
        ]);
    }
}
