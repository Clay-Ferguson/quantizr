import { dispatch } from "../../AppContext";
import { FullScreenGraphViewer } from "../../comp/FullScreenGraphViewer";
import { Constants as C } from "../../Constants";
import { FullScreenType } from "../../Interfaces";
import { TabBase } from "../../intf/TabBase";

export class GraphTab extends TabBase<any> {
    name = "Node Graph";
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

    constructView(_data: TabBase) {
        dispatch("RestoreGraph", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.GRAPH };
        });
        return null;
    }
}
