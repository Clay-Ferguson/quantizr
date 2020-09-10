import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { Main } from "./Main";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenCalendar extends Main {

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let nodeId = state.fullScreenCalendarId;
        let node: J.NodeInfo = S.meta64.findNodeById(state, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        this.setChildren([new Div("FullScreenCalendar: Node: " + nodeId)]);
    }
}
