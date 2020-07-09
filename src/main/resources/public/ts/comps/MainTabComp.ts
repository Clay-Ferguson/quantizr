import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { NodeCompMainNode } from "./NodeCompMainNode";
import { NodeCompMainList } from "./NodeCompMainList";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends Div {

    constructor() {
        super(null, {
            id: "mainTab",
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab==this.getId()) {
            this.attribs.className += " show active";
        }

        if (!state.node) {
            this.setChildren(null);
            return;
        }

        this.setChildren([
            new NodeCompMainNode(state, null),
            new NodeCompMainList()
        ]);
    }
}
