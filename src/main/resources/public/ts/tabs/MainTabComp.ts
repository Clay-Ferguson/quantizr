import { dispatch, useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { BreadcrumbsPanel } from "../comp/BreadcrumbsPanel";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Html } from "../comp/core/Html";
import { Icon } from "../comp/core/Icon";
import { Span } from "../comp/core/Span";
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
        let state = useAppState();
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

        let panelCols = state.userPreferences.mainPanelCols || 6;

        let widthSizerPanel = !state.mobileMode ? new Span(null, { className: "widthSizerPanel float-end" }, [
            panelCols > 4 ? new Icon({
                className: "fa fa-step-backward widthSizerIcon",
                title: "Narrower view",
                onClick: () => {
                    dispatch("widthAdjust", s => {
                        S.edit.setMainPanelCols(--s.userPreferences.mainPanelCols);
                        return s;
                    });
                }
            }) : null,
            panelCols < 8 ? new Icon({
                className: "fa fa-step-forward widthSizerIcon",
                title: "Wider view",
                onClick: () => {
                    dispatch("widthAdjust", s => {
                        S.edit.setMainPanelCols(++s.userPreferences.mainPanelCols);
                        return s;
                    });
                }
            }) : null
        ]) : null;

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

                // if we have some parents to display well then let's just do that...
                state.node.parents?.length > 0 ? new NodeCompParentNodes(state, this.data, null) : null,

                new Div(null, { className: state.userPreferences.editMode ? "my-tab-pane-editmode" : null }, [
                    new NodeCompMainNode(state, this.data, null),
                    new NodeCompMainList(this.data)
                ])
            ])
        ]);
    }
}
