import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class AppTab extends Div {
    data: TabDataIntf;

    constructor(data: TabDataIntf) {
        super(null, { id: data.id });
        this.data = data;
    }
}
