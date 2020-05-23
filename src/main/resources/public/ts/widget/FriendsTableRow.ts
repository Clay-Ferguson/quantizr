import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Heading } from "./Heading";
import { ReactNode } from "react";
import { ButtonBar } from "./ButtonBar";
import { FriendInfo } from "../JavaIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

//todo-0: can ListBoxRow be a base class for this?
export class FriendsTableRow extends Comp {

    constructor(public friend: FriendInfo) {
        super(null);
        this.setClass("list-group-item list-group-item-action");
    }

    compRender(): ReactNode {
        this.setChildren([
            new Heading(4, this.friend.userName),
        ]);

        return this.tagRender('div', null, this.attribs);
    }
}
