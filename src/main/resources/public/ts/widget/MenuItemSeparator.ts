import { Div } from "./Div";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class MenuItemSeparator extends Div {

    constructor() {
        super(null, {
            className: "menuItemSeparator"
        });
    }
}
