import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { BreadcrumbsPanel } from "../comp/BreadcrumbsPanel";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { NodeCompMainList } from "../comp/node/NodeCompMainList";
import { NodeCompMainNode } from "../comp/node/NodeCompMainNode";
import { NodeCompParentNodes } from "../comp/node/NodeCompParentNodes";
import { TabDataIntf } from "../intf/TabDataIntf";

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class MainTabComp extends AppTab {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data, "my-tab-pane-editmode");
        this.attribs.key = "mainTabCompKey";
        data.inst = this;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        this.attribs.className = this.getClass(state);

        if (!state.node) {
            this.setChildren(null);
            return;
        }

        let renderableCrumbs = 0;
        if (state.breadcrumbs) {
            state.breadcrumbs.forEach(bc => {
                if (bc.id !== state.node.id && bc.id !== state.homeNodeId) {
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
                renderableCrumbs > 0 && !state.mobileMode ? new BreadcrumbsPanel() : null,
                state.pageMessage ? new Html(state.pageMessage, { className: "alert alert-info float-end" }) : null,
                state.pageMessage ? new Clearfix() : null,

                // if we have some parents to display well then let's just do that...
                state.node.parents?.length > 0 ? new NodeCompParentNodes(state, this.data, null) : null,

                new NodeCompMainNode(state, this.data, null),
                new NodeCompMainList(this.data)
            ])
        ]);
    }
}
