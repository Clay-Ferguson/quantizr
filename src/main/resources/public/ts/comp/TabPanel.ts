import { getAppState, promiseDispatch, useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { AppTab } from "./AppTab";
import { CompIntf } from "./base/CompIntf";
import { ButtonBar } from "./core/ButtonBar";

export class TabPanel extends Div {
    static inst: TabPanel;

    constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB });
        TabPanel.inst = this;
        const state = getAppState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            const panelCols = state.userPrefs.mainPanelCols || 6;
            this.attribs.className = "col-" + panelCols + " tabPanel";
        }
    }

    setVisibility = async (visible: boolean) => {
        await promiseDispatch("SetTabPanelVis", s => {
            s.tabPanelVisible = visible;
            return s;
        });
    }

    preRender(): void {
        const state = useAppState();

        if (!state.tabPanelVisible) {
            // todo-0: not sure why, but this had no effect, we're ok without it, but
            // would be MUCH nicer if we hide the comp during scrolling.
            this.attribs.className += " comp-hidden";
        }

        this.setChildren([
            this.customTopComp,
            new Div(null, {
                className: "row tab-content",
                role: "main",
                id: "tabPanelContentId"
            }, this.buildTabs(state)),
            !state.mobileMode ? new ButtonBar([
                S.quanta.activeTab === C.TAB_MAIN && S.nav.parentVisibleToUser(state) ? new IconButton("fa-folder", "Up Level", {
                    nid: state.node.id,
                    onClick: S.nav.navUpLevelClick,
                    title: "Go to Parent Node"
                }) : null,
                new IconButton("fa-angle-double-up", null, {
                    onClick: () => S.view.scrollActiveToTop(state),
                    title: "Scroll to Top"
                }, null, "off")
            ], null, "scrollTopButtonLowerRight") : null
        ]);
    }

    buildTabs = (state: AppState): AppTab[] => {
        const tabs = state.tabData.map(tab => {
            if (tab.isVisible(state)) {
                return tab.constructView(tab);
            }
            return null;
        }).filter(c => !!c);
        return tabs;
    }
}
