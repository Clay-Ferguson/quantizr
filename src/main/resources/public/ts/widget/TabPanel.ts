import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanel extends Div {

    constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB });
        this.domAddEvent = this.domAddEvent.bind(this);
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile";
        }
        else {
            let state: AppState = store.getState();
            this.attribs.className = "col-" + state.mainPanelCols + " tabPanel";
        }
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        let tabContent = new Div(null, {
            className: "row tab-content",
            role: "main",
            key: this.attribs.key + "_topdiv"
        }, this.buildTabs(state));

        this.setChildren([
            this.customTopComp,
            tabContent
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
