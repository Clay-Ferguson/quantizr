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
            style: { display: state.timelineResults ? "inline" : "none" },
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
        let results = state.timelineResults;

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

        if (state.timelineDescription) {
            children.push(new Span(null, null, [
                new TextContent(state.timelineDescription)
                // todo-1: add something like this eventually ?
                // new Anchor(null, "Refresh", { className: "float-right", onClick: S.search.timelineRefresh }),
                // new Div(null, { className: "clearfix" })
            ]));
        }

        let i = 0;
        results.forEach((node: J.NodeInfo) => {
            // console.log("TIMELINE: node id=" + node.id + " content: " + node.content);
            S.srch.initSearchNode(node);
            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, "timeln", false, false, true, true, state));
            i++;
            rowCount++;
        });

        this.setChildren(children);
    }
}
