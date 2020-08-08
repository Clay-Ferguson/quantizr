import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Main } from "./Main";
import { AppState } from "../AppState";
import { useSelector, useDispatch } from "react-redux";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenGraphViewer extends Main {

    constructor() {
        super();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        // let nodeId = state.fullScreenViewId;
        // let node: J.NodeInfo = S.meta64.findNodeById(state, nodeId);

        // if (!node) {
        //     console.log("Can't find nodeId "+nodeId);
        // }

        // let isAnAccountNode = node && node.ownerId && node.id == node.ownerId;

        // let children = [];

        // if (node && S.props.hasBinary(node) && !isAnAccountNode) {
        //     let binary = new NodeCompBinary(node, false, true, null);
        //     children.push(binary);
        // }

        this.setChildren([new Div("Graph goes here")]);
    }
}
