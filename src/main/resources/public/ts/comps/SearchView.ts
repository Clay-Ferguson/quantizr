import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { IconButton } from "../widget/IconButton";
import { Li } from "../widget/Li";
import { Span } from "../widget/Span";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class SearchView extends AppTab {

    constructor() {
        super({
            id: "searchTab"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = state.searchInfo.results;
        this.attribs.className = "tab-pane fade my-tab-pane";

        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        if (!results || results.length === 0) {
            this.setChildren([new Div("No Search Displaying", {
                id: "searchResultsPanel"
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

        if (state.searchInfo.description && state.searchInfo.node) {
            let searchText = S.util.getShortContent(state.searchInfo.node.content);
            children.push(new Div(null, null, [
                new Div(null, { className: "marginBottom" }, [
                    new Heading(4, "Search", { className: "resultsTitle" }),
                    new Span(null, { className: "float-right" }, [
                        new IconButton("fa-arrow-left", "Back", {
                            onClick: () => S.view.refreshTree(state.searchInfo.node.id, true, true, state.searchInfo.node.id, false, true, true, state),
                            title: "Back to Node"
                        })
                    ])
                ]),
                new TextContent(searchText, "resultsContentHeading alert alert-secondary"),
                new Div("Searched -> " + state.searchInfo.description)
            ]));
        }

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + state.searchInfo.page + " endReached=" + state.searchInfo.endReached));
        this.addPaginationBar(state, children);

        let i = 0;
        let jumpButton = state.isAdminUser || !state.searchInfo.userSearchType;
        results.forEach(function (node: J.NodeInfo) {
            S.srch.initSearchNode(node);
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "srch", false, false, true, jumpButton, state));
            i++;
            rowCount++;
        });

        this.addPaginationBar(state, children);
        this.setChildren(children);
    }

    addPaginationBar = (state: AppState, children: Comp[]): void => {

        children.push(new ButtonBar([
            state.searchInfo.page > 1 ? new IconButton("fa-angle-double-left", null, {
                onClick: () => S.srch.searchPageChange(state, 0),
                title: "First Page"
            }) : null,
            state.searchInfo.page > 0 ? new IconButton("fa-angle-left", null, {
                onClick: () => S.srch.searchPageChange(state, -1),
                title: "Previous Page"
            }) : null,
            !state.searchInfo.endReached ? new IconButton("fa-angle-right", "More", {
                onClick: () => S.srch.searchPageChange(state, 1),
                title: "Next Page"
            }) : null
        ], "text-center marginBottom"));
    }
}
