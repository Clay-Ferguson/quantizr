import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

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

        this.setChildren([
        ]);
    }
}
