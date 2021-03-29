import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
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
                "col-" + (C.mainPanelCols + 2) + //
                " col-md-" + (C.mainPanelCols + 1) +//
                " col-lg-" + C.mainPanelCols + //
                // " col-xl-" + C.mainPanelCols + // not needed. 'lg' covers the 'xl' case
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
            className: "row tab-content",
            role: "main"
        }, children);

        this.setChildren([
            dialog ? null : new TabPanelButtons(), tabContent
        ]);
    }
}
