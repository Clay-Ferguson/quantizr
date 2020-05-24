import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Heading } from "./Heading";
import { FriendInfo } from "../JavaIntf";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//todo-0: can ListBoxRow be a base class for this?
export class FriendsTableRow extends Div {

    constructor(public friend: FriendInfo) {
        super();
        this.setClass("list-group-item list-group-item-action");
    }

    preRender(): void {
        this.setChildren([
            new Heading(4, this.friend.userName),
        ]);
    }
}
