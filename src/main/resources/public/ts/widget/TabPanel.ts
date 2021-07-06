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
        super(null, { id: C.ID_TAB, tabIndex: "-1" });
        this.domAddEvent = this.domAddEvent.bind(this);
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 " + (state.userPreferences.editMode ? "tabPanelMobileEditMode" : "tabPanelMobile") + " normalScrollbar";
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

    /* Note: The fact that we have the scrollbar on THIS component, means we have to manage
     all the scroll states by 'S.meta64.activtTab' as the key to retrieve current scroll pos. It would have
     also been possible to let EACH actual tab component do this independently, and somehow build that logic
     into a base class of those views (todo-0: is menu panel an example of this?) */
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

    domAddEvent(): void {
        let elm = this.getRef();
        this.reScroll(elm);

        elm.addEventListener("scroll", () => {
            // console.log("Scroll pos: " + S.meta64.activeTab + ": " + elm.scrollTop);
            S.meta64.scrollPosByTabName.set(S.meta64.activeTab, elm.scrollTop);
        }, { passive: true });

        super.domAddEvent();
    }

    domPreUpdateEvent(): void {
        let elm = this.getRef();
        this.reScroll(elm);
        super.domPreUpdateEvent();
    }
}
