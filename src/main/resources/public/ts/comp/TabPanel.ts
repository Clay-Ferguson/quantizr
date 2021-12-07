import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";
import { IconButton } from "./IconButton";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanel extends Div {

    constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB });
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            let state: AppState = store.getState();
            let panelCols = state.userPreferences.mainPanelCols || 5;
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

    buildTabs = (state: AppState): CompIntf[] => {
        let tabs: CompIntf[] = [];
        for (let tab of state.tabData) {
            tabs.push(tab.constructView(tab));
        }
        return tabs;
    }
}
