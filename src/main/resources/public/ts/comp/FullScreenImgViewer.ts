import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { NodeCompBinary } from "../comp/node/NodeCompBinary";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Main } from "./Main";

export class FullScreenImgViewer extends Main {

    constructor() {
        super();
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let nodeId = state.fullScreenViewId;
        let node: J.NodeInfo = S.nodeUtil.findNodeById(state, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        let isAnAccountNode = node?.ownerId && node.id === node.ownerId;
        let children = [];

        if (node && S.props.hasBinary(node) && !isAnAccountNode) {
            let binary = new NodeCompBinary(node, false, true, null);
            children.push(binary);
        }

        this.setChildren(children);
    }

    domUpdateEvent = (): void => {
        if (C.DEBUG_SCROLLING) {
            console.log("domUpdateEvent scroll top");
        }
        if (S.view.docElm) {
            S.view.docElm.scrollTop = 0;
        }
    }
}
