import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { AppTab } from "./AppTab";
import { CompIntf } from "./base/CompIntf";

export class TabPanel extends Div {

    constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB });
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            let state: AppState = store.getState();
            let panelCols = state.userPreferences.mainPanelCols || 6;
            this.attribs.className = "col-" + panelCols + " tabPanel";
        }
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        let tabContent = new Div(null, {
            className: "row tab-content",
            role: "main",
            key: this.attribs.key + "_topdiv"
        }, this.buildTabs(state));

        let scrollUpButton = state.mobileMode ? new IconButton("fa-angle-double-up", null, {
            onClick: e => {
                S.view.scrollAllTop(state);
            },
            title: "Scroll to Top"
        }, "btn-primary scrollTopButtonLowerRight", "off") : null;

        this.setChildren([
            this.customTopComp,
            tabContent,
            scrollUpButton
        ]);
    }

    buildTabs = (state: AppState): AppTab[] => {
        let tabs: AppTab[] = [];
        for (let tab of state.tabData) {
            if (tab.isVisible()) {
                tabs.push(tab.constructView(tab));
            }
        }
        return tabs;
    }
}
