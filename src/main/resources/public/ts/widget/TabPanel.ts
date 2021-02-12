import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { FeedView } from "../comps/FeedView";
import { MainTabComp } from "../comps/MainTabComp";
import { SearchView } from "../comps/SearchView";
import { TimelineView } from "../comps/TimelineView";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";
import { TabPanelButtons } from "./TabPanelButtons";
import { useSelector } from "react-redux";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "./base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanel extends Div {

    constructor() {
        super(null);

        if (clientInfo.isMobile) {
            this.attribs.className = "col-12";
        }
        else {
            this.attribs.className = "col-" + C.mainPanelCols + " offset-" + C.leftNavPanelCols;
        }
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);
        let dialog: DialogBase = null;
        if (state.dialogStack.length > 0) {
            dialog = state.dialogStack[state.dialogStack.length - 1];
        }

        let children: CompIntf[] = dialog ? [dialog] : [
            new MainTabComp(),
            new SearchView(),
            new TimelineView(),
            new FeedView()
        ];

        let tabContent = new Div(null, {
            className: "row tab-content",
            role: "main"
        }, children);

        this.setChildren([
            dialog ? null : new TabPanelButtons(), tabContent
        ]);
    }
}
