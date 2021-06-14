import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowFooter } from "./NodeCompRowFooter";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMainNode extends Div {

    constructor(state: AppState, public imgSizeOverride: string) {
        super(null, {
            id: S.nav._UID_ROWID_PREFIX + state.node.id,
            tabIndex: "-1"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = state.node;

        if (!node) {
            this.setChildren(null);
            return;
        }

        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        let selected: boolean = (focusNode && focusNode.id === node.id);
        this.attribs.className = "mainNodeContentStyle " + (selected ? "active-row-main" : "inactive-row-main");

        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.meta64.fadeStartTime = new Date().getTime();
        }

        this.attribs.nid = node.id;
        this.attribs.onClick = S.nav.clickNodeRow;

        let header: CompIntf = null;
        if (state.userPreferences.showMetaData) {
            header = new NodeCompRowHeader(node, true, true, false, false);
        }

        let extraClass = state.userPreferences.showMetaData && state.userPreferences.editMode ? "nodeCompButtonBar" : null;
        this.setChildren([
            header,
            !state.inlineEditId ? new NodeCompButtonBar(node, false, 1, null, extraClass) : null,
            new Div(null, {
                className: "clearfix",
                id: "button_bar_clearfix_" + node.id
            }),
            new NodeCompContent(node, false, true, null, null, this.imgSizeOverride, true),
            new NodeCompRowFooter(node, false)
        ]);
    }
}
