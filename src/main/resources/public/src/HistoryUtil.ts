import { dispatch, getAs } from "./AppContext";
import { IndexedDBObj } from "./Interfaces";
import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { S } from "./Singletons";

export class NodeHistoryItem {
    content: string;
    id: string;
    type: string;
}

export class HistoryUtil {
    historySaverInterval = null;
    historyDirty = false;
    static NODEHISTORY_KEY = "NodeHistoryData";
    lastPushedUrl: string = null;
    static historyUpdateEnabled = true;

    async loadHistoryData() {
        const val: IndexedDBObj = await S.localDB.readObject(HistoryUtil.NODEHISTORY_KEY);
        if (val) {
            dispatch("loadHistoryData", s => s.nodeHistory = val.v);
        }
    }

    _clearHistory = async () => {
        dispatch("clearHistoryData", s => s.nodeHistory = []);
        await S.localDB.setVal(HistoryUtil.NODEHISTORY_KEY, []);
        this.historyDirty = false;
    }

    _historySaverFunc = async () => {
        if (!this.historyDirty) return;
        await S.localDB.setVal(HistoryUtil.NODEHISTORY_KEY, getAs().nodeHistory);
        this.historyDirty = false;
    }

    initHistorySaver() {
        // if already initialized return
        if (this.historySaverInterval) return;
        this.historySaverInterval = setInterval(this._historySaverFunc, 5000);
    }

    /* Pushes history with nodeId and/or view */
    pushHistory(nodeId: string, view: string) {
        if (!HistoryUtil.historyUpdateEnabled) return;

        let url = window.location.origin + "?";

        let addedParts = false;
        if (nodeId) {
            url += "id=" + nodeId;
            addedParts = true;
        }
        if (view) {
            if (addedParts) {
                url += "&";
            }
            url += "view=" + view;
        }
        const newHistObj = {
            nodeId
        };

        if (this.lastPushedUrl === url) {
            return;
        }
        this.lastPushedUrl = url;

        history.pushState(newHistObj, "Open View", url);
        // console.log("PUSHED STATE(with view) url: " + url + ", state: " + JSON.stringify(newHistObj) + " length=" + history.length);
    }

    pushTreeHistory(node: NodeInfo) {
        if (!HistoryUtil.historyUpdateEnabled) return;
        const ast = getAs();

        if (!node) {
            node = ast.node;
        }
        if (!node) {
            return;
        }

        let content = S.nodeUtil.getShortContent(node);
        if (!content) {
            content = node.id;
        }
        let url, title, newHistObj;
        if (node.name) {
            const queryPath = S.nodeUtil.getPathPartForNamedNode(node);
            url = window.location.origin + queryPath;

            newHistObj = {
                nodeId: ":" + node.name
            };
            title = node.name;
        }
        else {
            url = window.location.origin + "?id=" + node.id;

            newHistObj = {
                nodeId: node.id
            };
            title = content;
        }

        if (this.lastPushedUrl === url) {
            return;
        }
        this.lastPushedUrl = url;

        history.pushState(newHistObj, title, url);

        if (!ast.isAnonUser) {
            this.updateNodeHistory(node, false);
        }
    }

    // If 'addLater=true' this means we can't alter state right now, because it could destroy text
    // the user is tempting to 'mouse select' and so we just get ready to add to history the next
    // chance we get.
    updateNodeHistory(node: NodeInfo, addLater: boolean) {
        if (!node || !node.id || getAs().nodeHistoryLocked ||
            S.props.getClientPropStr(J.NodeProp.IN_PENDING_PATH, node)) {
            return;
        }

        dispatch("updateNodeHistory", s => {
            // remove node if it exists in history (so we can add to top)
            s.nodeHistory = s.nodeHistory.filter(h => h.id !== node.id);

            // now add to top.
            s.nodeHistory.unshift({ id: node.id, type: node.type, content: S.nodeUtil.getShortContent(node) });
            while (s.nodeHistory.length > 40) s.nodeHistory.pop();
        }, addLater);

        this.historyDirty = true;
    }

    /* Updates 'nodeHistory' when nodes are deleted */
    removeNodesFromHistory(selNodesArray: string[]) {
        if (!selNodesArray) return;
        dispatch("removeNodesFromHistory", s => {
            selNodesArray.forEach(id => {
                // remove any top level history item that matches 'id'
                s.nodeHistory = s.nodeHistory.filter(h => h.id !== id);
            });
        });
    }
}