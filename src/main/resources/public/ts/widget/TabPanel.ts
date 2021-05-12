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
        super(null);
        const state: AppState = store.getState();

        if (state.mobileMode) {
            this.attribs.className = "col-12 tab-panel-mobile";
        }
        else {
            // See also: RightNavPanel.ts which has the inverse/balance of these numbers of columns.
            this.attribs.className = //
                // =======================================
                // see: other places these tags exist
                // for #NON_DYNAMIC_COLS
                "col-" + (C.mainPanelCols) + //
                // #DYNAMIC_COLS
                // "col-" + (C.mainPanelCols + 3) + //
                // " col-md-" + (C.mainPanelCols + 2) +//
                // " col-lg-" + (C.mainPanelCols + 1) + //
                // " col-xl-" + C.mainPanelCols + //
                // =======================================

                " offset-" + C.leftNavPanelCols;
        }
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);
        let dialog: DialogBase = null;
        if (state.dialogStack.length > 0) {
            dialog = state.dialogStack[state.dialogStack.length - 1];
        }

        let children: CompIntf[] = dialog ? [dialog] : S.meta64.tabs;

        let tabContent = new Div(null, {
            className: "row " + (state.mobileMode ? "tab-content-mobile" : "tab-content"),
            role: "main"
        }, children);

        let tabButtons = !dialog && state.mobileMode;

        this.setChildren([
            tabButtons ? new TabPanelButtons(false) : null, tabContent
        ]);
    }
}
