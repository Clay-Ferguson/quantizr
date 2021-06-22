import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { Log } from "../Log";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { State } from "../State";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanel extends Div {

constructor(private customTopComp: CompIntf = null) {
        super(null, { id: C.ID_TAB, tabIndex: "-1" });
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tabPanelMobile normalScrollbar";
        }
        else {
            let state: AppState = store.getState();
            this.attribs.className = "col-" + state.mainPanelCols +
                (state.userPreferences.editMode && state.activeTab === C.TAB_MAIN ? " tabPanelEditMode" : " tabPanel") +
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
            role: "main",
            key: this.attribs.key + "_topdiv"
        }, children);

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

    reScroll = (elm: HTMLElement): void => {
        /* Set the scroll position back to whatever it should be for the currently active tab.
         todo-1: we have some scroll setting happening in the tab change event too
         (do we need both this and that?) */
        if (S.meta64.scrollPosByTabName.has(S.meta64.activeTab)) {
            let newPos = S.meta64.scrollPosByTabName.get(S.meta64.activeTab);
            // #DEBUG-SCROLLING
            // console.log("scroll " + S.meta64.activeTab + " to " + newPos + " in onAddEvent");
            elm.scrollTop = newPos;
        }
    }

    onAddEvent = (elm: HTMLElement): void => {
        this.reScroll(elm);

        elm.addEventListener("scroll", () => {
            // console.log("Scroll pos: " + S.meta64.activeTab + ": " + elm.scrollTop);
            S.meta64.lastScrollTime = new Date().getTime();
            S.meta64.scrollPosByTabName.set(S.meta64.activeTab, elm.scrollTop);
        }, { passive: true });
    }

    domPreUpdateEvent = (elm: HTMLElement): void => {
        this.reScroll(elm);
    }
}
