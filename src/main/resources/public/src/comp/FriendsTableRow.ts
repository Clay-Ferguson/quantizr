import { getAs } from "../AppContext";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { FriendInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { LS as FriendsDlgState } from "../dlg/FriendsDlg";
import { SelectTagsDlg, LS as SelectTagsDlgLS } from "../dlg/SelectTagsDlg";
import { ListBoxRow } from "./ListBoxRow";
import { Comp } from "./base/Comp";
import { Checkbox } from "./core/Checkbox";
import { FlexLayout } from "./core/FlexLayout";
import { Icon } from "./core/Icon";

export class FriendsTableRow extends ListBoxRow {

    constructor(public friend: FriendInfo, private selectableRows: boolean, private dlg: Comp) {
        super(null, null, null);
        this.attribs.className = "personsListItem";
    }

    override preRender = (): boolean => {
        const ast = getAs();
        let src: string = null;

        if (this.friend.avatarVer) {
            src = S.render.getAvatarImgUrl(this.friend.userNodeId, this.friend.avatarVer);
        }
        else {
            console.log("no avatarVer on friend: " + this.friend.userNodeId);
        }

        this.children = [
            new FlexLayout([
                this.selectableRows ? new Checkbox(null, { className: "personsListItemCheckBox" }, {
                    setValue: (checked: boolean) => {
                        const state: FriendsDlgState = this.dlg.getState();
                        if (checked) {
                            state.selections.add(this.friend.userName);
                        }
                        else {
                            state.selections.delete(this.friend.userName);
                        }
                        this.dlg.mergeState(state);
                    },
                    getValue: (): boolean => this.dlg.getState<FriendsDlgState>().selections.has(this.friend.userName)
                }) : null,

                new Div(null, { className: "friendListImgDivCont" }, [
                    new Div(null, {
                        className: "friendListImgDiv centerChild",
                        [C.USER_ID_ATTR]: this.friend.userNodeId,
                        onClick: S.nav.clickToOpenUserProfile,
                        title: "Click for Profile"
                    }, [
                        src ? new Img({
                            className: "friendListImage",
                            src,
                        }) : null
                    ])
                ]),

                new Div(null, {
                    className: "marginLeft marginTop",
                    [C.USER_ID_ATTR]: this.friend.userNodeId,
                    onClick: S.nav.clickToOpenUserProfile,
                    title: "Click for Profile"
                }, [
                    this.friend.displayName ? new Div(this.friend.displayName, { className: "friendName" }) : null,
                    this.friend.userName ? new Div("@" + this.friend.userName) : null
                ]),

                // Only if we know the friendNodeId here (set on server) do we have the ability to
                // show friend-specific tags, because if friendNodeId is null it just means this is
                // a user independent of anything to do with Friends.
                this.friend.friendNodeId ? S.render.renderTagsStrDiv(this.friend.tags, "bigMarginLeft marginTop", this.removeTag, this.editTags) : null,

                this.friend.liked ? new Icon({
                    title: "This person Liked the Node",
                    className: "fa fa-star fa-lg marginTop bigMarginLeft " +
                        (this.friend.userName === ast.userName ? "likedByMeIcon" : "")
                }) : null
            ], "flexAlignChildrenTop")
        ];
        return true;
    }

    editTags = async () => {
        const dlg = new SelectTagsDlg("edit", this.friend.tags, false);
        await dlg.open();
        this.addTags(dlg);
    }

    addTags = (dlg: SelectTagsDlg) => {
        let val = this.friend.tags || "";
        val = val.trim();
        const tags: string[] = val.split(" ");
        dlg.getState<SelectTagsDlgLS>().selectedTags.forEach(tag => {
            if (!tag.startsWith("#")) {
                tag = "#" + tag;
            }
            if (!tags.includes(tag)) {
                if (val) val += " ";
                val += tag;
            }
        });

        this.friend.tags = this.sortTags(val);
        S.rpcUtil.rpc<J.UpdateFriendNodeRequest, J.UpdateFriendNodeResponse>("updateFriendNode", {
            nodeId: this.friend.friendNodeId,
            tags: this.friend.tags
        });

        this.dlg.mergeState({});
    }

    sortTags = (tagStr: string): string => {
        if (!tagStr) return tagStr;
        const tags: string[] = tagStr.split(" ");
        tags.sort();
        return tags.join(" ");
    }

    removeTag = (removeTag: string) => {
        let val = this.friend.tags || "";
        val = val.trim();
        const tags: string[] = val.split(" ");
        let newTags = "";

        tags.forEach(tag => {
            if (removeTag !== tag) {
                if (newTags) newTags += " ";
                newTags += tag;
            }
        });

        this.friend.tags = newTags;
        S.rpcUtil.rpc<J.UpdateFriendNodeRequest, J.UpdateFriendNodeResponse>("updateFriendNode", {
            nodeId: this.friend.friendNodeId,
            tags: this.friend.tags
        });
        this.dlg.mergeState({});
    }
}
