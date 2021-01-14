import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { Html } from "./Html";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CollapsibleHelpPanel extends CollapsiblePanel {

    constructor(html: string, stateCallback: Function = null, expanded: boolean = false) {
        super("Help", "Hide Help", null, [new Html(html)], false, stateCallback, expanded, "marginLeft", "marginLeft marginTop");
    }
}
