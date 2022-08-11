import { useAppState } from "../AppRedux";
import { AppTab } from "../comp/AppTab";
import { BreadcrumbsPanel } from "../comp/BreadcrumbsPanel";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { NodeCompMainList } from "../comp/node/NodeCompMainList";
import { NodeCompMainNode } from "../comp/node/NodeCompMainNode";
import { NodeCompParentNodes } from "../comp/node/NodeCompParentNodes";
import { TabIntf } from "../intf/TabIntf";
import { S } from "../Singletons";

export class MainTabComp extends AppTab {

    constructor(data: TabIntf) {
        super(data, null);
        this.attribs.key = "mainTabCompKey";
        data.inst = this;
    }

    preRender(): void {
        const state = useAppState();
        this.attribs.className = this.getClass(state);

        if (!state.node) {
            this.setChildren(null);
            return;
        }

        // DO NOT DELETE (currently we have the 'show parents' button that ALWAYS needs to be available so we
        // will always render the BreadcrumbesPanel)
        // let renderableCrumbs = 0;
        // if (state.breadcrumbs) {
        //     state.breadcrumbs.forEach(bc => {
        //         if (bc.id !== state.node.id && bc.id !== state.homeNodeId) {
        //             renderableCrumbs++;
        //         }
        //     });
        // }

        const widthSizerPanel = S.render.makeWidthSizerPanel();

        this.setChildren([
            widthSizerPanel,
            widthSizerPanel ? new Clearfix() : null,
            new Div(null, {
                // This visibility setting makes the main content not visible until final scrolling is complete
                // I'm not sure this rendering animation is still needed, or even noticeable. todo-2
                className: state.rendering ? "compHidden" : "compVisible"
            }, [
                !state.mobileMode ? new BreadcrumbsPanel() : null,
                state.pageMessage ? new Html(state.pageMessage, { className: "alert alert-info float-end" }) : null,
                state.pageMessage ? new Clearfix() : null,

                // if we have some parents to display...
                state.node.parents?.length > 0 ? new NodeCompParentNodes(state, this.data, null) : null,

                new Div(null, { className: state.userPrefs.editMode ? "my-tab-pane-editmode" : null }, [
                    new NodeCompMainNode(state, this.data, null),
                    new NodeCompMainList(this.data)
                ])
            ])
        ]);
    }
}
