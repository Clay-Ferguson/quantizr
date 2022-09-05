import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { DocumentRSInfo } from "../../DocumentRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { DocumentResultSetView } from "../DocumentResultSetView";

export class DocumentTab implements TabIntf<DocumentRSInfo> {
    name = "Document";
    tooltip = "Document View of Node"
    id = C.TAB_DOCUMENT;
    props = new DocumentRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    static inst: DocumentTab = null;
    constructor() {
        DocumentTab.inst = this;
    }

    isVisible = (state: AppState) => S.tabUtil.resultSetHasData(C.TAB_DOCUMENT);
    constructView = (data: TabIntf) => new DocumentResultSetView<DocumentRSInfo>(data);
    getTabSubOptions = (state: AppState): Div => { return null; };

    findNode = (state: AppState, nodeId: string): J.NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted = (state: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (state: AppState, newNode: J.NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n.id === newNode.id ? newNode : n;
        });
    }
}
