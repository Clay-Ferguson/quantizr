import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { DocumentRSInfo } from "../../DocumentRSInfo";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { DocumentResultSetView } from "../DocumentResultSetView";

export class DocumentTab implements TabIntf<DocumentRSInfo> {
    name = "Document";
    tooltip = "Document View of Node"
    id = C.TAB_DOCUMENT;
    props = new DocumentRSInfo();
    scrollPos = 0;
    openGraphComps: OpenGraphPanel[] = [];

    topmostVisibleElmId: string = null;

    static inst: DocumentTab = null;
    constructor() {
        DocumentTab.inst = this;
    }

    isVisible = () => S.tabUtil.resultSetHasData(C.TAB_DOCUMENT);
    constructView = (data: TabIntf) => new DocumentResultSetView<DocumentRSInfo>(data);
    getTabSubOptions = (): Div => { return null; };

    findNode = (nodeId: string): NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    findNodeByPath = (_path: string): NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (_ust: AppState, newNode: NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode = (_ust: AppState, func: (node: NodeInfo) => void): void => {
        this.props.results?.forEach(n => func(n));
    }
}
