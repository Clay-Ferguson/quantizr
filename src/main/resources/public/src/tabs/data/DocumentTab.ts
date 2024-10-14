import { AppState } from "../../AppState";
import { Constants as C } from "../../Constants";
import { DocumentRSInfo } from "../../DocumentRSInfo";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { DocumentResultSetView } from "../DocumentResultSetView";

export class DocumentTab extends TabBase<DocumentRSInfo> {
    name = "Document";
    tooltip = "Document View of Node"
    id = C.TAB_DOCUMENT;
    props = new DocumentRSInfo();
    static inst: DocumentTab = null;
    static URL_PARAM = "doc";

    constructor() {
        super();
        DocumentTab.inst = this;
    }

    isVisible() {
        return S.tabUtil.resultSetHasData(C.TAB_DOCUMENT);
    }

    static selectIfOpened(): boolean {
        if (DocumentTab.inst.isVisible()) {
            S.tabUtil.selectTab(C.TAB_DOCUMENT);
            return true;
        }
        return false;
    }

    constructView(data: TabBase) {
        return new DocumentResultSetView<DocumentRSInfo>(data);
    }

    findNode(nodeId: string): NodeInfo {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted(_ust: AppState, nodeId: string): void {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode(_ust: AppState, newNode: NodeInfo): void {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode(_ust: AppState, func: (node: NodeInfo) => void): void {
        this.props.results?.forEach(n => func(n));
    }
}
