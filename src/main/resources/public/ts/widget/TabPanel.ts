import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";
import { TabPanelButtons } from "./TabPanelButtons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanel extends Div {

    constructor() {
        super(null, { id: C.ID_TAB });
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tab-panel-mobile";
        }
        else {
            let state: AppState = store.getState();
            this.attribs.className = "col-" + state.mainPanelCols + " " +
                (state.userPreferences.editMode && state.activeTab === C.TAB_MAIN ? "tabPanelEditMode" : "tabPanel") +
                " customScrollbar";
        }
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);
        let dialog: DialogBase = null;
        if (state.dialogStack.length > 0) {
            dialog = state.dialogStack[state.dialogStack.length - 1];
        }

        let children: CompIntf[] = dialog ? [dialog] : this.buildTabs(state);

        let tabContent = new Div(null, {
            className: "row tab-content",
            role: "main"
        }, children);

        let tabButtons = !dialog && state.mobileMode;

        this.setChildren([
            tabButtons ? new TabPanelButtons(false) : null,
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

    domPreUpdateEvent = (): void => {
        this.whenElm((elm) => {
            // saveScrollPosition() call should have already loaded this scroll position.
            if (S.meta64.scrollPosByTabName.has(C.TAB_MAIN)) {
                let newPos = S.meta64.scrollPosByTabName.get(C.TAB_MAIN);
                // console.log("Restoring tab " + C.TAB_MAIN + " to " + newPos + " in domPreUpdateEvent");
                elm.scrollTop = newPos;
            }
        });
    }
}
