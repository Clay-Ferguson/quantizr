import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { Div } from "../widget/Div";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class FeedView extends Div {

    constructor() {
        super(null, {
            id: "feedTab",
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab == this.getId()) {
            this.attribs.className += " show active";
        }

        if (!state.feedResults || state.feedResults.length == 0) {
            this.setChildren([
                new Div("Nothing to show here. Nobody has posted anything.", {
                    id: "feedResultsPanel"
                })
            ]);
            return;
        }

        let childCount = state.feedResults.length;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on the
         * client side for various reasons.
         */
        let rowCount = 0;
        let children: Comp[] = [];

        children.push(new ButtonBar([
            new Button("Refresh Feed", () => {
                S.nav.navFeed(state)
            })
        ], null, "float-right marginBottom"));
        children.push(new Div(null, { className: "clearfix" }));

        let i = 0;
        let lastOwner: string = null;
        state.feedResults.forEach((node: J.NodeInfo) => {
            //console.log("FEED: node id=" + node.id + " content: " + node.content);
            S.srch.initSearchNode(node);

            //For now, let's just allow all feed items to show the avatar. 
            let allowAvatar = true; //node.owner != lastOwner;

            children.push(S.srch.renderSearchResultAsListItem(node, i, childCount, rowCount, allowAvatar, "feed", true, false, state));
            lastOwner = node.owner;
            i++;
            rowCount++;
        });

        this.setChildren(children);
    }
}
