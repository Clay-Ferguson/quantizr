import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ResultSetInfo } from "../../ResultSetInfo";
import { S } from "../../Singletons";
import { SearchResultSetView } from "../SearchResultSetView";
import * as J from "../../JavaIntf";

export class SearchResultSetViewData implements TabIntf<ResultSetInfo> {
    name = "Search";
    tooltip = "Showing the results of your most recent search";
    id = C.TAB_SEARCH;
    props = new ResultSetInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: SearchResultSetViewData = null;
    constructor() {
        SearchResultSetViewData.inst = this;
    }

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_SEARCH);
    constructView = (data: TabIntf) => new SearchResultSetView(data)
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (nodeId: string): J.NodeInfo => {
        return this.props.results.find(n => n.id === nodeId);
    }

    nodeDeleted = (nodeId: string): void => {
        this.props.results = this.props.results.filter(n => nodeId !== n.id);
    }
}
