import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
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

    getTabButton(state: AppState): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: state.searchResults ? "inline" : "none" },
            onClick: this.handleClick
        }, [
            new Anchor("#searchTab", "Search", {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === "searchTab" ? " active" : "")
            })
        ]);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = state.searchResults;

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

        if (state.searchDescription && state.searchNode) {
            let searchText = S.util.getShortContent(state.searchNode.content);
            children.push(new Div(null, null, [
                new Div(null, null, [
                    new Heading(4, "Search", { className: "resultsTitle" }),
                    new Span(null, { className: "float-right" }, [
                        new IconButton("fa-arrow-left", "Back", {
                            onClick: () => S.view.refreshTree(state.searchNode.id, true, true, state.searchNode.id, false, true, true, state),
                            title: "Back to Node"
                        })
                    ])
                ]),
                new TextContent(searchText, "resultsContentHeading alert alert-secondary"),
                new Div("Searched -> " + state.searchDescription)
            ]));
        }

        let i = 0;
        let jumpButton = state.isAdminUser || !state.isUserSearch;
        results.forEach(function (node: J.NodeInfo) {
            S.srch.initSearchNode(node);
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "srch", false, false, true, jumpButton, state));
            i++;
            rowCount++;
        });

        this.setChildren(children);
    }
}
