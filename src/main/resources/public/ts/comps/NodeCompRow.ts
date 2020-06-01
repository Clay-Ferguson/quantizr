import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { Div } from "../widget/Div";
import { NodeCompContent } from "./NodeCompContent";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRow extends Div {

    /* we have this flag so we can turn off buttons to troubleshoot performance. */
    static showButtonBar: boolean = true;

    constructor(public node: J.NodeInfo, public index: number, public count: number, public rowCount: number, public level: number, public layoutClass: string, public allowNodeMove: boolean) {
        super(null, {
            id: "row_" + node.id
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let id: string = node.id;
        //console.log("Rendering NodeCompRow. id=" + node.id);

        this.attribs.onClick = S.meta64.getNodeFunc(S.nav.cached_clickNodeRow, "S.nav.clickNodeRow", node.id);

        //console.log("owner=" + node.owner + " lastOwner=" + this.lastOwner);
        let buttonBar: Comp = null;
        if (NodeCompRow.showButtonBar) {
            let allowAvatar = node.owner != S.render.lastOwner;
            buttonBar = new NodeCompButtonBar(node, allowAvatar, this.allowNodeMove);
        }

        let indentLevel = this.layoutClass === "node-grid-item" ? 0 : this.level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;

        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        let selected: boolean = (focusNode && focusNode.id === id);
        this.attribs.className = this.layoutClass + (selected ? " active-row" : " inactive-row");
        this.attribs.style = style;

        this.setChildren([
            buttonBar,
            buttonBar ? new Div(null, {
                className: "clearfix",
                id: "button_bar_clearfix_" + node.id
            }) : null,
            new NodeCompContent(node, true, true)
        ]);

        S.render.setNodeDropHandler(this, node, state);
    }

    /* Return an object such that, if this object changes, we must render, or else we don't need to render 
  
    This implementation is technically very incorrect, but was enough to just use the selection state and ID to
    determine of the caching of ReactNodes (via. Comp.memoMap) rather than constructing them from scratch
    on every render was enough to create a noticeable performance gain. Unfortunately it WAS NOT. So the 'memoMap'
    experimental code is being left in place for now, but the approach didn't work. There's more notes in Comp.ts
    about this performance hack attempt.
    */
    makeCacheKeyObj(appState: AppState, state: any, props: any) {
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(appState);
        let selected: boolean = (focusNode && focusNode.id === this.node.id);
        let key = this.node.id + " " + selected;
        //console.log("cache key: " + key + " for element: " + this.jsClassName);
        return key;
        // state = this.getState();
        // return {
        //     nodeId: this.node.id,
        //     content: this.node.content,
        //     stateEnabled: state.enabled,
        //     props,
        // };
    }
}
