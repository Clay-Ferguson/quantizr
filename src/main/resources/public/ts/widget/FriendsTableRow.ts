import { FriendInfo } from "../JavaIntf";
import { Div } from "./Div";
import { ListBoxRow } from "./ListBoxRow";

export class FriendsTableRow extends ListBoxRow {

    constructor(public friend: FriendInfo, onClickFunc: Function, public isSelected: boolean) {
        super(null, onClickFunc);
    }

    preRender(): void {
        this.setChildren([
            new Div(this.friend.userName, {
                className: "heading5" + (this.isSelected ? " selectedListItem" : " unselectedListItem")
            })
        ]);
    }
}
