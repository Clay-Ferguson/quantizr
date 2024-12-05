import { dispatch } from "../../AppContext";
import { FullScreenGraphViewer } from "../../comp/FullScreenGraphViewer";
import { Constants as C } from "../../Constants";
import { FullScreenType } from "../../Interfaces";
import { TabBase } from "../../intf/TabBase";

export class GraphTab extends TabBase<any, any> {
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

    // todo-0: It's kind of ugly that constructView uses a side effect rather than constructing a view. Fix this and also
    // check to see if here are other cases of this.
    constructView(_data: TabBase<any, any>): any {
        dispatch("RestoreGraph", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.GRAPH };
        });
        return null;
    }
}
