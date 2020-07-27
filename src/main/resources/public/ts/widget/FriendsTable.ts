import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { FriendInfo } from "../JavaIntf";
import { FriendsTableRow } from "./FriendsTableRow";
import { ListBox } from "./ListBox";
import { ValueIntf } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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
                }, this.valueIntf.getValue() == friend.userName));
            });
        }
        this.setChildren(children);
    }
}
