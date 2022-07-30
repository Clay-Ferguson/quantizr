import { getAppState, useAppState } from "../AppRedux";
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
        let state = getAppState();

        // todo-0: this block can be written simpler
        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            let panelCols = state.userPrefs.mainPanelCols || 6;
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
                key: this.attribs.key + "_topdiv"
            }, this.buildTabs(state)),
            !state.mobileMode ? new IconButton("fa-angle-double-up", null, {
                onClick: () => S.view.scrollAllTop(state),
                title: "Scroll to Top"
            }, "btn-primary scrollTopButtonLowerRight", "off") : null
        ]);
    }

    buildTabs = (state: AppState): AppTab[] => {
        let tabs = state.tabData.map(tab => {
            if (tab.isVisible(state)) {
                return tab.constructView(tab);
            }
            return null;
        }).filter(c => !!c);
        return tabs;
    }
}
