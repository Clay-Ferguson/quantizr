import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { QuickEditField } from "../widget/QuickEditField";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRow extends Div {

    /* we have this flag so we can turn off buttons to troubleshoot performance. */
    static showButtonBar: boolean = true;

    constructor(public node: J.NodeInfo, public index: number, public count: number, public rowCount: number, public level: number,
        public layoutClass: string, public allowNodeMove: boolean, public imgSizeOverride: string, appState: AppState) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + node.id
        });

        /* If we're in edit mode allow dragging */
        if (appState.userPreferences.editMode && !appState.inlineEditId && !QuickEditField.editingId) {
            this.attribs.draggable = "true";
            this.attribs.onDragStart = this.dragStart;
            this.attribs.onDragEnd = this.dragEnd;
        }
    }

    dragStart = (ev): void => {
        /* If mouse is not over type icon during a drag start don't allow dragging. This way the entire ROW is the thing that is
        getting dragged, but we don't accept drag events anywhere on the node, because we specifically don't want to. We intentionally
        have draggableId so make is so that the user can only do a drag by clicking the type icon itself to start the drag. */
        if (S.meta64.draggableId !== this.node.id) {
            ev.preventDefault();
            return;
        }
        ev.target.style.borderLeft = "6px dotted green";
        ev.dataTransfer.setData("text", ev.target.id);
    }

    dragEnd = (ev): void => {
        ev.target.style.borderLeft = "6px solid transparent";
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let id: string = node.id;
        // console.log("Rendering NodeCompRow. id=" + node.id);

        this.attribs.onClick = S.meta64.getNodeFunc(S.nav.cached_clickNodeRow, "S.nav.clickNodeRow", node.id);

        // console.log("owner=" + node.owner + " lastOwner=" + this.lastOwner);
        let buttonBar: Comp = null;
        if (NodeCompRow.showButtonBar && !state.inlineEditId) {
            let allowAvatar = node.owner !== S.render.lastOwner;
            buttonBar = new NodeCompButtonBar(node, allowAvatar, this.allowNodeMove);
        }

        let indentLevel = this.layoutClass === "node-grid-item" ? 0 : this.level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;

        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        let selected: boolean = (focusNode && focusNode.id === id);
        this.attribs.className = (this.layoutClass || "") + (selected ? " active-row" : " inactive-row");

        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.meta64.fadeStartTime = new Date().getTime();
        }

        this.attribs.style = style;

        let header: CompIntf = null;
        if (state.userPreferences.showMetaData) {
            header = new NodeCompRowHeader(node, false);
        }

        // if editMode is on, an this isn't the page root node
        if (state.userPreferences.editMode && this.node.id !== state.node.id) {
            S.render.setNodeDropHandler(this.attribs, this.node, true, state);
        }

        this.setChildren([
            header,
            buttonBar,
            buttonBar ? new Div(null, {
                className: "clearfix",
                id: "button_bar_clearfix_" + node.id
            }) : null,
            new NodeCompContent(node, true, true, null, null, this.imgSizeOverride)
        ]);
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
        // console.log("cache key: " + key + " for element: " + this.jsClassName);
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
