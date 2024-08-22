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

    loadHistoryData = async () => {
        const val: IndexedDBObj = await S.localDB.readObject(HistoryUtil.NODEHISTORY_KEY);
        if (val) {
            dispatch("loadHistoryData", s => s.nodeHistory = val.v);
        }
    }

    clearHistory = async () => {
        dispatch("clearHistoryData", s => s.nodeHistory = []);
        await S.localDB.setVal(HistoryUtil.NODEHISTORY_KEY, []);
        this.historyDirty = false;
    }

    historySaverFunc = async () => {
        if (!this.historyDirty) return;
        await S.localDB.setVal(HistoryUtil.NODEHISTORY_KEY, getAs().nodeHistory);
        this.historyDirty = false;
    }

    initHistorySaver = () => {
        // if already initialized return
        if (this.historySaverInterval) return;
        this.historySaverInterval = setInterval(this.historySaverFunc, 5000);
    }

    updateHistoryById = (nodeId: string, view: string) => {
        let url = window.location.origin + "?id=" + nodeId;
        if (view) {
            url += "&view=" + view;
        }
        const newHistObj = {
            nodeId
        };
        history.pushState(newHistObj, "Open View", url);
    }

    updateHistory = (node: NodeInfo) => {
        if (!node) {
            node = getAs().node;
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

        if (newHistObj.nodeId === history.state?.nodeId) {
            history.replaceState(newHistObj, title, url);
            // console.log("REPLACED STATE: title: " + title + " url: " + url + ", state: " + JSON.stringify(newHistObj) + " length=" + history.length);
        }
        else {
            history.pushState(newHistObj, title, url);
            // console.log("PUSHED STATE: title: " + title + " url: " + url + ", state: " + JSON.stringify(newHistObj) + " length=" + history.length);
        }

        this.updateNodeHistory(node, false);
    }

    // If 'addLater=true' this means we can't alter state right now, because it could destroy text
    // the user is tempting to 'mouse select' and so we just get ready to add to history the next
    // chance we get.
    updateNodeHistory = (node: NodeInfo, addLater: boolean) => {
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
    removeNodesFromHistory = (selNodesArray: string[]) => {
        if (!selNodesArray) return;
        dispatch("removeNodesFromHistory", s => {
            selNodesArray.forEach(id => {
                // remove any top level history item that matches 'id'
                s.nodeHistory = s.nodeHistory.filter(h => h.id !== id);
            });
        });
    }
}