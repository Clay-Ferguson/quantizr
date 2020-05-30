import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";
import { Ul } from "./Ul";
import { Li } from "./Li";
import { Anchor } from "./Anchor";
import { dispatch } from "../AppRedux";
import { Heading } from "./Heading";
import { CompIntf } from "./base/CompIntf";
import { MenuPanel } from "../MenuPanel";
import clientInfo from "../ClientInfo";


let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LeftNavPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "col-" + C.leftNavPanelCols + " leftNavPanel position-fixed";
    }


    preRender(): void {
        //Haven't figured out yet how I want to deal with scrolling in left
        //panel which seems incompatible with it being 'fixed' positioning.
        //let state: AppState = useSelector((state: AppState) => state);
        // if (!clientInfo.isMobile) {
        //     this.setChildren([new MenuPanel(state)]);
        // }
    }
}
