import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { AppTab } from "../widget/AppTab";
import { Comp } from "../widget/base/Comp";
import { BreadcrumbsPanel } from "../widget/BreadcrumbsPanel";
import { Div } from "../widget/Div";
import { Html } from "../widget/Html";
import { NodeCompMainList } from "./NodeCompMainList";
import { NodeCompMainNode } from "./NodeCompMainNode";
import { Constants as C } from "../Constants";
import { Li } from "../widget/Li";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends AppTab {

    constructor() {
        super({
            id: "mainTab"
        });
    }

    getTabButton(state: AppState): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: "inline" }
        }, [
            new Anchor("#mainTab", "Main", {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === "mainTab" ? " active" : ""),
                onClick: () => {
                    S.meta64.selectTab("mainTab");
                }
            })
        ]);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.attribs.className = "tab-pane fade my-tab-pane";
        if (state.activeTab === this.getId()) {
            this.attribs.className += " show active";
        }

        if (!state.node) {
            this.setChildren(null);
            return;
        }

        let showBreadcrumbs = state.breadcrumbs && state.breadcrumbs.length > 0;

        this.setChildren([
            new Div(null, {
                // This visibility setting makes the main content not visible until final scrolling is complete
                className: state.rendering ? "compHidden" : "compVisible"
            }, [
                showBreadcrumbs ? new BreadcrumbsPanel() : null,
                state.pageMessage ? new Html(state.pageMessage, { className: "alert alert-info float-right" }) : null,
                state.pageMessage ? new Div(null, { className: "clearfix" }) : null,
                new NodeCompMainNode(state, null),
                new NodeCompMainList()
            ])
        ]);
    }
}
