import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";
import { MenuPanel } from "../MenuPanel";
import clientInfo from "../ClientInfo";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class LeftNavPanel extends Div {

    constructor() {
        super();
        this.attribs.className = "col-" + C.leftNavPanelCols + " leftNavPanel position-fixed customScrollbar";
    }

    preRender(): void {
        //Haven't figured out yet how I want to deal with scrolling in left
        //panel which seems incompatible with it being 'fixed' positioning.
        let state: AppState = useSelector((state: AppState) => state);
        if (!state.isAnonUser && !clientInfo.isMobile) {
            this.setChildren([
                new Div(null, {
                    className: "float-right menuContainer"
                }, [
                    new MenuPanel(state)
                ])
            ])
        }
    }
}
