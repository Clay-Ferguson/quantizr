import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Div } from "../comp/core/Div";
import { OpenGraphPanel } from "../comp/OpenGraphPanel";
import * as J from "../JavaIntf";

export interface TabIntf<T = any> {
    // display name shown on the tab
    name: string;

    // help tooltip for menu
    tooltip: string;

    /* DOM ID of the tab button itself, but also the unique identifier for the tab. Note: even if there are perhaps
     multiple different instances of the same AppTab-derived class each one will need to have a unique id. This means
    we can in the future support multiple SearchView tabs opened simultaneously, each with a different ID of course */
    id: string;
    scrollPos: number;
    inst?: AppTab;

    constructView(data: TabIntf): AppTab;
    getTabSubOptions(state: AppState): Div;

    // controls whether to show tab button or not.
    isVisible(state: AppState): boolean;

    // tabs are required to be able to search their known nodes and find any that are found, or null if not found
    findNode(nodeId: string): J.NodeInfo;
    nodeDeleted(nodeId: string): void;

    props: T;

    openGraphComps: OpenGraphPanel[];
}
