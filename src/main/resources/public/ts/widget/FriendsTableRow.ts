import { Constants as C } from "../Constants";
import { FriendInfo } from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { ListBoxRow } from "./ListBoxRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsTableRow extends ListBoxRow {

    constructor(public friend: FriendInfo, onClickFunc: Function, public isSelected: boolean) {
        super(null, onClickFunc);
    }

    preRender(): void {
        this.setChildren([
            new Div(this.friend.userName, {
                className: "heading5" + (this.isSelected ? " selectedListItem" : " unselectedListItem")
            }),
        ]);
    }
}
