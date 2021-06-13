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
        this.whenElm((elm: HTMLElement) => {

            /* We set the scroll position back to whatever it should be for the currently active tab */
            if (S.meta64.scrollPosByTabName.has(S.meta64.activeTab)) {
                let newPos = S.meta64.scrollPosByTabName.get(S.meta64.activeTab);
                // console.log("Restoring tab " + S.meta64.activeTab + " to " + newPos + " in domPreUpdateEvent");
                elm.scrollTop = newPos;
            }

            /* Listen to scroll position change, and update the active tab value in realtime.
            (this can't get added multiple times can it? I need to verify. If it DOES duplicate listeners
            it will still have only a slight performance degradation. todo-1
            */
            elm.addEventListener("scroll", () => {
                // console.log("Scroll pos: " + elm.scrollTop);
                S.meta64.scrollPosByTabName.set(S.meta64.activeTab, elm.scrollTop);
            }, { passive: true });
        });
    }
}
