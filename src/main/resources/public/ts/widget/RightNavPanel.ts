import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RightNavPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "col-" + C.rightNavPanelCols + " offset-" + (C.leftNavPanelCols + C.mainPanelCols) + " rightNavPanel position-fixed";
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);
        // let buttons: Comp[] = this.getButtons(state);
        // this.setChildren(buttons);
    }
}
