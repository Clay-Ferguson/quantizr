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
        // See also: TabPanel.ts which has the inverse/balance of these numbers of columns.
        this.attribs.className = //
            "col-" + (C.rightNavPanelCols - 3) + //
            " col-md-" + (C.rightNavPanelCols - 2) + //
            " col-lg-" + (C.rightNavPanelCols - 1) + //
            " col-xl-" + C.rightNavPanelCols + //
            " offset-" + (C.leftNavPanelCols + C.mainPanelCols) + " rightNavPanel position-fixed";
    }

    preRender(): void {
    }
}
