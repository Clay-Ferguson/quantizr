import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { FriendInfo } from "../JavaIntf";
import { Div } from "./Div";
import { FriendsTableRow } from "./FriendsTableRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FriendsTable extends Div {

    constructor(private friends: FriendInfo[]) {
        super();
        this.mergeState(friends);
        this.setClass("list-group marginBottom");
    }

    preRender(): void {
        this.children = [];

        let friends: FriendInfo[] = this.getState().friends;
        //console.log("compRender[" + this.jsClassName + "] STATE: " + S.util.prettyPrint(nodePrivsInfo));

        if (friends) {
            friends.forEach(function(friend) {
                this.addChild(new FriendsTableRow(friend));
            }, this);
        }
    }
}
