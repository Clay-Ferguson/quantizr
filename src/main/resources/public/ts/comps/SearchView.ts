import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
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
            className: "tab-pane fade my-tab-pane"
        });
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        let results = useSelector((state: AppState) => state.searchResults);
        let mstate = useSelector((state: AppState) => state.mstate);

        if (!results || results.length == 0) {
            this.setChildren([new Div("No Search Displaying", {
                id: "searchResultsPanel",
                className: "searchResultsPanel"
            })]);
            return this.super_CompRender();
        }

        let childCount = results.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;

        let children: Comp[] = [];
        let i = -1;
        results.forEach((node: J.NodeInfo) => {
            i++;
            S.srch.initSearchNode(node);

            rowCount++;
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, mstate));
        });

        this.setChildren(children);

        return this.super_CompRender();
    }
}
