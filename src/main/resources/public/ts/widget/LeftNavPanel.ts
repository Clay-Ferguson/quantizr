import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { Constants as C } from "../Constants";
import { MenuPanel } from "../MenuPanel";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

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
