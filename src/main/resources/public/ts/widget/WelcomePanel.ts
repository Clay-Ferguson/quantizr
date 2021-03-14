import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { NodeCompContent } from "../comps/NodeCompContent";
import { NodeCompTableRowLayout } from "../comps/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "../comps/NodeCompVerticalRowLayout";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class WelcomePanel extends Div {

    constructor(attribs: Object = {}) {
        super(null, attribs);

        setTimeout(() => {
            S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: ":welcome-page",
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: false
            }, (res) => {
                this.mergeState({ welcomeNode: res.node });
            });
        }, 250);
    }

    preRender(): void {
        const state: AppState = store.getState();
        if (this.getState().welcomeNode) {
            this.setChildren([
                new NodeCompContent(this.getState().welcomeNode, false, false, null, null, null),
                !state.mobileMode ? new NodeCompTableRowLayout(this.getState().welcomeNode, 1, "c", false, false)
                    : new NodeCompVerticalRowLayout(this.getState().welcomeNode, 1, false, false)
            ]);
        }
        else {
            this.setChildren([new Div("Loading...")]);
        }
    }
}
