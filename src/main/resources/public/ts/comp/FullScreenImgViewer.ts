import { useAppState } from "../AppContext";
import { NodeCompBinary } from "../comp/node/NodeCompBinary";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { Main } from "./Main";
import * as J from "../JavaIntf";

// todo-0: need to handle multiple images on the same node and do this
// (INSTEAD OF?) the child node siblings stuff. &&&
export class FullScreenImgViewer extends Main {
    constructor() {
        super();
    }

    preRender(): void {
        const state = useAppState();
        const nodeId = state.fullScreenConfig.nodeId;
        const node = S.nodeUtil.findNode(state, nodeId);
        if (!node) {
            console.error("Can't find nodeId " + nodeId);
        }

        const isAnAccountNode = node?.ownerId && node.id === node.ownerId;
        const children = [];

        if (S.props.hasBinary(node) && !isAnAccountNode) {
            const binary = new NodeCompBinary(node, J.Constant.ATTACHMENT_PRIMARY, false, true);
            children.push(binary);
        }

        this.setChildren(children);
    }

    domUpdateEvent = () => {
        if (C.DEBUG_SCROLLING) {
            console.log("domUpdateEvent scroll top");
        }
        if (S.view.docElm) {
            // NOTE: Since the docElm component doesn't manage scroll position, we can get away with just
            // setting scrollTop on it directly like this, instead of calling 'elm.setScrollTop()'
            S.view.docElm.scrollTop = 0;
        }
    }
}
