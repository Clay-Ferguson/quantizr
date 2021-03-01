import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class TimelineView extends Div {

    constructor() {
        super(null, {
            id: "timelineTab"
        });
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
            children.push(new TextContent(state.timelineDescription));
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
