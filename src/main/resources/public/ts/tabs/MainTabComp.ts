import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AppTab } from "../widget/AppTab";
import { BreadcrumbsPanel } from "../widget/BreadcrumbsPanel";
import { Div } from "../widget/Div";
import { Html } from "../widget/Html";
import { NodeCompMainList } from "../comps/NodeCompMainList";
import { NodeCompMainNode } from "../comps/NodeCompMainNode";
import { Clearfix } from "../widget/Clearfix";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends AppTab {

    constructor(data: TabDataIntf) {
        super(data);
        this.attribs.key = "mainTabCompKey";
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

        let renderableCrumbs = 0;
        if (state.breadcrumbs) {
            state.breadcrumbs.forEach(bc => {
                if (bc.id !== state.homeNodeId) {
                    renderableCrumbs++;
                }
            });
        }

        this.setChildren([
            new Div(null, {
                // This visibility setting makes the main content not visible until final scrolling is complete
                // I'm not sure this rendering animation is still needed, or even noticeable. todo-2
                className: state.rendering ? "compHidden" : "compVisible"
            }, [
                renderableCrumbs > 1 && !state.mobileMode ? new BreadcrumbsPanel() : null,
                state.pageMessage ? new Html(state.pageMessage, { className: "alert alert-info float-right" }) : null,
                state.pageMessage ? new Clearfix() : null,
                new NodeCompMainNode(state, null),
                new NodeCompMainList()
            ])
        ]);
    }
}
