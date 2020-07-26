import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { FriendInfo } from "../JavaIntf";
import { FriendsTableRow } from "./FriendsTableRow";
import { ListBox } from "./ListBox";
import * as J from "../JavaIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsTable extends ListBox {

    constructor() {
        super();

        S.util.ajax<J.GetFriendsRequest, J.GetFriendsResponse>("getFriends", {
        }, (res: J.GetFriendsResponse): void => {
            this.mergeState({
                selectedPayload: null,
                friends: res.friends
            });
        });
    }

    preRender(): void {
        this.setChildren([]);

        let friends: FriendInfo[] = this.getState().friends;
        //console.log("compRender[" + this.jsClassName + "] STATE: " + S.util.prettyPrint(nodePrivsInfo));

        if (friends) {
            friends.forEach(function (friend) {
                this.addChild(new FriendsTableRow(this, friend));
            }, this);
        }
    }
}
