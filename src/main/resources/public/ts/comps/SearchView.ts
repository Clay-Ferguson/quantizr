import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class SearchView extends Div {

    constructor() {
        super(null, {
            id: "searchTab",
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = state.searchResults;

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab==this.getId()) {
            this.attribs.className += " show active";
        }

        if (!results || results.length == 0) {
            this.setChildren([new Div("No Search Displaying", {
                id: "searchResultsPanel",
            })]);
            return;
        }

        let childCount = results.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: Comp[] = [];
        let i = 0;
        let lastOwner: string = null;
        results.forEach(function(node: J.NodeInfo) {
            S.srch.initSearchNode(node);

            let allowAvatar = node.owner != lastOwner;
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, allowAvatar, "srch", state));
            lastOwner = node.owner;
            i++;
            rowCount++;
        });

        this.setChildren(children);
    }
}
