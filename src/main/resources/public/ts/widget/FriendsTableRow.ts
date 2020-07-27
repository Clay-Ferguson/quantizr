import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { FriendInfo } from "../JavaIntf";
import { ListBoxRow } from "./ListBoxRow";
import { ListBox } from "./ListBox";
import { Div } from "./Div";

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
