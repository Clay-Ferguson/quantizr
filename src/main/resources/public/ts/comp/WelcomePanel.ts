import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { NodeCompContent } from "../comp/node/NodeCompContent";
import { NodeCompTableRowLayout } from "../comp/node/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "../comp/node/NodeCompVerticalRowLayout";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";

interface LS {
    welcomeNode: J.NodeInfo;
}

export class WelcomePanel extends Div {

    constructor(attribs: Object = {}) {
        super(null, attribs);

        setTimeout(async () => {
            let res: J.RenderNodeResponse = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: ":welcome-page",
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false
            });

            this.mergeState<LS>({ welcomeNode: res.node });
        }, 20);
    }

    preRender(): void {
        const state: AppState = store.getState();
        if (this.getState<LS>().welcomeNode) {
            this.setChildren([
                new NodeCompContent(this.getState<LS>().welcomeNode, false, false, null, null, null, true),
                !state.mobileMode ? new NodeCompTableRowLayout(this.getState<LS>().welcomeNode, 1, "c", false, false)
                    : new NodeCompVerticalRowLayout(this.getState<LS>().welcomeNode, 1, false, false)
            ]);
        }
        else {
            this.setChildren([new Div("Loading...")]);
        }
    }
}
