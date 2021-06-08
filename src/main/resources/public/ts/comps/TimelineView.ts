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
export class TimelineView extends AppTab {

    constructor() {
        super({
            id: "timelineTab"
        });
    }

    getTabButton(state: AppState): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: state.timelineInfo.results ? "inline" : "none" },
            onClick: this.handleClick
        }, [
            new Anchor("#timelineTab", "Timeline", {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === "timelineTab" ? " active" : "")
            })
        ]);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let results = state.timelineInfo.results;

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        if (!results || results.length === 0) {
            this.setChildren([
                new Div("No Timeline Displaying", {
                    id: "timelineResultsPanel"
                })
            ]);
            return;
        }

        let childCount = results.length;
        let rowCount = 0;
        let children: Comp[] = [];

        if (state.timelineInfo.description && state.timelineInfo.node) {
            let timelineText = S.util.getShortContent(state.timelineInfo.node.content);
            children.push(new Div(null, null, [
                new Div(null, { className: "marginBottom" }, [
                    new Heading(4, "Timeline", { className: "resultsTitle" }),
                    new Span(null, { className: "float-right" }, [
                        new IconButton("fa-arrow-left", "Back", {
                            onClick: () => S.view.refreshTree(state.timelineInfo.node.id, true, true, state.timelineInfo.node.id, false, true, true, state),
                            title: "Back to Node"
                        })
                    ])
                ]),
                new TextContent(timelineText, "resultsContentHeading alert alert-secondary"),
                new Div(state.timelineInfo.description)
            ]));
        }

        this.addPaginationBar(state, children);

        let i = 0;
        results.forEach((node: J.NodeInfo) => {
            // console.log("TIMELINE: node id=" + node.id + " content: " + node.content);
            S.srch.initSearchNode(node);
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "timeln", false, false, true, true, state));
            i++;
            rowCount++;
        });

        this.addPaginationBar(state, children);
        this.setChildren(children);
    }

    addPaginationBar = (state: AppState, children: Comp[]): void => {

        // this shows the page number. not needed. used for debugging.
        // children.push(new Div("" + state.timelinePage + " endReached=" + state.timelineEndReached));

        children.push(new ButtonBar([
            state.timelineInfo.page > 1 ? new IconButton("fa-angle-double-left", null, {
                onClick: () => S.srch.timelinePageChange(state, 0),
                title: "First Page"
            }) : null,
            state.timelineInfo.page > 0 ? new IconButton("fa-angle-left", null, {
                onClick: () => S.srch.timelinePageChange(state, -1),
                title: "Previous Page"
            }) : null,
            !state.timelineInfo.endReached ? new IconButton("fa-angle-right", "More", {
                onClick: (event) => S.srch.timelinePageChange(state, 1),
                title: "Next Page"
            }) : null
        ], "text-center marginBottom"));
    }
}
