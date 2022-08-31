import { getAppState, useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { AppTab } from "./AppTab";
import { CompIntf } from "./base/CompIntf";
import { ButtonBar } from "./core/ButtonBar";

export class TabPanel extends Div {

    constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB });
        const state = getAppState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            const panelCols = state.userPrefs.mainPanelCols || 6;
            this.attribs.className = "col-" + panelCols + " tabPanel";
        }
    }

    preRender(): void {
        const state = useAppState();

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
