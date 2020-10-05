import { ValueIntf } from "../Interfaces";
import { FriendInfo } from "../JavaIntf";
import { FriendsTableRow } from "./FriendsTableRow";
import { ListBox } from "./ListBox";

export class FriendsTable extends ListBox {

    constructor(public friends: FriendInfo[], valueIntf: ValueIntf) {
        super(valueIntf);
    }

    preRender(): void {
        let children = [];

        if (this.friends) {
            this.friends.forEach((friend: FriendInfo) => {
                children.push(new FriendsTableRow(friend, () => {
                    this.updateValFunc(friend.userName);
                }, this.valueIntf.getValue() === friend.userName));
            });
        }
        this.setChildren(children);
    }
}
