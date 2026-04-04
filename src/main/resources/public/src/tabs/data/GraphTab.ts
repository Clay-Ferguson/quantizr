import { dispatch } from "../../AppContext";
import { FullScreenGraphViewer } from "../../comp/FullScreenGraphViewer";
import { Constants as C } from "../../Constants";
import { FullScreenType } from "../../Interfaces";
import { TabBase } from "../../intf/TabBase";

export class GraphTab extends TabBase<any> {
    name = "Graph";
    tooltip = "View Node Graph";
    id = C.TAB_GRAPH;
    props = {};

    static inst: GraphTab = null;
    constructor() {
        super();
        GraphTab.inst = this;
    }

    isVisible() {
        return FullScreenGraphViewer.div;
    }

    onActivate() {
        dispatch("RestoreGraph", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.GRAPH };
        });
    }

    // Note: We have a slight architectural inconsistency here because we build the actual view elsewhere
    constructView(_data: TabBase<any>): any {
        return null;
    }
}
