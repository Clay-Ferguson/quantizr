import { ValueIntf } from "../Interfaces";
import { FriendInfo } from "../JavaIntf";
import { FriendsTableRow } from "./FriendsTableRow";
import { ListBox } from "./ListBox";

export class FriendsTable extends ListBox {

    constructor(public friends: FriendInfo[], valueIntf: ValueIntf) {
        super(valueIntf);
    }

    preRender(): void {
        if (this.friends) {
            this.setChildren(this.friends.map(friend => {
                return new FriendsTableRow(friend, () => {
                    this.updateVal(friend.userName);
                }, this.valueIntf.getValue() === friend.userName);
            }));
        }
    }
}
