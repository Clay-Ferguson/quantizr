import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { ResultSetInfo } from "../../ResultSetInfo";
import { S } from "../../Singletons";
import { SearchResultSetView } from "../SearchResultSetView";

export class SearchTab extends TabBase<ResultSetInfo, SearchResultSetView<ResultSetInfo>> {
    name = "Search";
    tooltip = "Showing the results of your most recent search";
    id = C.TAB_SEARCH;
    props = new ResultSetInfo();
    static inst: SearchTab = null;

    constructor() {
        super();
        SearchTab.inst = this;
    }

    isVisible() {
        return S.tabUtil.resultSetHasData(C.TAB_SEARCH);
    }
    constructView(data: TabBase<ResultSetInfo, SearchResultSetView<ResultSetInfo>>): SearchResultSetView<ResultSetInfo> {
        return new SearchResultSetView(data);
    }

    findNode(nodeId: string): NodeInfo {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted(_ust: AppState, nodeId: string): void {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode(_ust: AppState, newNode: NodeInfo): void {
        if (!this.props.results) return;

        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode(_ust: AppState, func: (node: NodeInfo) => void): void {
        this.props.results?.forEach(n => func(n));
    }
}
