import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { NodeCompBinary } from "../comps/NodeCompBinary";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Main } from "./Main";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenImgViewer extends Main {

    constructor() {
        super();
        this.domUpdateEvent = this.domUpdateEvent.bind(this);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let nodeId = state.fullScreenViewId;
        let node: J.NodeInfo = S.meta64.findNodeById(state, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        let isAnAccountNode = node && node.ownerId && node.id === node.ownerId;
        let children = [];

        if (node && S.props.hasBinary(node) && !isAnAccountNode) {
            let binary = new NodeCompBinary(node, false, true, null);
            children.push(binary);
        }

        this.setChildren(children);
    }

    domUpdateEvent(): void {
        // #DEBUG-SCROLLING
        S.view.docElm.scrollTop = 0;
        super.domUpdateEvent();
    }
}
