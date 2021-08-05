import { EventInput } from "@fullcalendar/react";
import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { EditIntf } from "./intf/EditIntf";
import * as J from "./JavaIntf";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Edit implements EditIntf {

    showReadOnlyProperties: boolean = false;

    openChangePasswordDlg = (state: AppState): void => {
        new ChangePasswordDlg(null, state).open();
    }

    openManageAccountDlg = (state: AppState): void => {
        new ManageAccountDlg(state).open();
    }

    editPreferences = (state: AppState): void => {
        new PrefsDlg(state).open();
    }

    openImportDlg = (state: AppState): void => {
        const node: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg = new UploadFromFileDropzoneDlg(node.id, "", false, null, true, true, state, () => {
            S.meta64.refresh(state);
        });
        dlg.open();
    }

    openExportDlg = (state: AppState): void => {
        let node = S.meta64.getHighlightedNode(state);
        if (node) {
            new ExportDlg(state, node).open();
        }
    }

    private insertBookResponse = (res: J.InsertBookResponse, state: AppState): void => {
        S.util.checkSuccess("Insert Book", res);

        S.view.refreshTree(null, true, false, null, false, true, true, state);
        S.view.scrollToSelectedNode(state);
    }

    private deleteNodesResponse = (res: J.DeleteNodesResponse, postDelSelNodeId: string, state: AppState): void => {
        if (S.util.checkSuccess("Delete node", res)) {
            // We only want to pass a nodeId here if we are going to root node.
            const nodeId = postDelSelNodeId === state.homeNodeId ? postDelSelNodeId : null;
            S.view.refreshTree(nodeId, false, false, postDelSelNodeId, false, true, true, state);
        }
    }

    private joinNodesResponse = (res: J.JoinNodesResponse, state: AppState): void => {
        state = appState(state);
        if (S.util.checkSuccess("Join node", res)) {
            S.meta64.clearSelNodes(state);
            S.view.refreshTree(state.node.id, false, false, null, false, true, true, state);
        }
    }

    public initNodeEditResponse = (res: J.InitNodeEditResponse, encrypt: boolean, showJumpButton: boolean, state: AppState): void => {
        if (S.util.checkSuccess("Editing node", res)) {
            const node: J.NodeInfo = res.nodeInfo;

            /* NOTE: Removing 'editMode' check here is new 4/14/21, and without was stopping editing from calendar view which we
            do need even when edit mode is technically off */
            const editingAllowed = /* state.userPreferences.editMode && */ this.isEditAllowed(node, state);
            if (editingAllowed) {
                /* Either run the node editor as a popup or embedded, depending on whether we have a fullscreen
                calendar up and wether we're on the main tab, etc */
                if (state.mobileMode ||
                    // node not found on tree.
                    (!S.meta64.getDisplayingNode(state, res.nodeInfo.id) &&
                        !S.meta64.getDisplayingNode(state, S.meta64.newNodeTargetId)) ||
                    // not currently viewing tree
                    S.meta64.activeTab !== C.TAB_MAIN ||
                    S.meta64.fullscreenViewerActive(state)) {
                    const dlg = new EditNodeDlg(res.nodeInfo, encrypt, showJumpButton, state);
                    dlg.open();
                } else {
                    dispatch("Action_startEditing", (s: AppState): AppState => {
                        s.editNode = res.nodeInfo;
                        s.editShowJumpButton = showJumpButton;
                        s.editEncrypt = encrypt;
                        return s;
                    });
                }
            } else {
                S.util.showMessage("Editing not allowed on node.", "Warning");
            }
        }
    }

    /* nodeId is optional and represents what to highlight after the paste if anything */
    private moveNodesResponse = (res: J.MoveNodesResponse, nodeId: string, state: AppState): void => {
        if (S.util.checkSuccess("Move nodes", res)) {
            dispatch("Action_SetNodesToMove", (s: AppState): AppState => {
                s.nodesToMove = null;
                return s;
            });

            S.view.refreshTree(null, false, false, nodeId, false, true, true, state);
        }
    }

    private setNodePositionResponse = (res: J.SetNodePositionResponse, state: AppState): void => {
        if (S.util.checkSuccess("Change node position", res)) {
            S.meta64.refresh(state);
        }
    }

    /* returns true if we are admin or else the owner of the node */
    isEditAllowed = (node: any, state: AppState): boolean => {
        if (!node) return false;
        let owner: string = node.owner;

        // if we don't know who owns this node assume the admin owns it.
        if (!owner) {
            owner = "admin";
        }

        return state.isAdminUser || state.userName === owner;
    }

    isInsertAllowed = (node: J.NodeInfo, state: AppState): boolean => {
        if (!node) return false;
        if (state.homeNodeId === node.id) {
            return true;
        }

        if (S.props.isPublicWritable(node)) {
            return true;
        }

        let owner: string = node.owner;

        // if we don't know who owns this node assume the admin owns it.
        if (!owner) {
            owner = "admin";
        }

        // if this node is admin owned, and we aren't the admin, then just disable editing. Admin himself is not even allowed to
        // make nodes editable by any other user.
        if (owner === "admin" && !state.isAdminUser) return false;

        // right now, for logged in users, we enable the 'new' button because the CPU load for determining it's enablement is too much, so
        // we throw an exception if they cannot. todo-2: need to make this work better.
        // however we CAN check if this node is an "admin" node and at least disallow any inserts under admin-owned nodess
        if (state.isAdminUser) return true;
        if (state.isAnonUser) return false;

        /* if we own the node we can edit it! */
        if (state.userName === node.owner) {
            // console.log("node owned by me: " + node.owner);
            return true;
        }

        if (S.props.isPublicReadOnly(node)) {
            return false;
        }

        // console.log("isInsertAllowed: node.owner="+node.owner+" nodeI="+node.id);
        return node.owner !== "admin";
    }

    /*
    * nodeInsertTarget holds the node that was clicked on at the time the insert was requested, and
    * is sent to server for ordinal position assignment of new node. Also if this var is null, it indicates we are
    * creating in a 'create under parent' mode, versus non-null meaning 'insert inline' type of insert.
    */
    startEditingNewNode = async (typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, nodeInsertTarget: J.NodeInfo, ordinalOffset: number, state: AppState): Promise<void> => {
        if (!this.isInsertAllowed(parentNode, state)) {
            // console.log("Rejecting request to edit. Not authorized");
            return;
        }

        if (S.meta64.ctrlKeyCheck()) {
            new ConfirmDlg("Paste your clipboard content into a new node?", "Create from Clipboard", //
                async () => {
                    let clipboardText = await (navigator as any).clipboard.readText();
                    if (nodeInsertTarget) {
                        S.util.ajax<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                            pendingEdit: false,
                            parentId: parentNode.id,
                            targetOrdinal: nodeInsertTarget.ordinal + ordinalOffset,
                            newNodeName: "",
                            typeName: typeName || "u",
                            initialValue: clipboardText
                        }, (res) => { S.meta64.refresh(state); });
                    } else {
                        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                            pendingEdit: false,
                            nodeId: parentNode.id,
                            newNodeName: "",
                            typeName: typeName || "u",
                            createAtTop,
                            content: clipboardText,
                            typeLock: false,
                            properties: null
                        }, (res) => { S.meta64.refresh(state); });
                    }
                }, null, null, null, state
            ).open();
        }
        else {
            if (nodeInsertTarget) {
                S.util.ajax<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                    pendingEdit: true,
                    parentId: parentNode.id,
                    targetOrdinal: nodeInsertTarget.ordinal + ordinalOffset,
                    newNodeName: "",
                    typeName: typeName || "u",
                    initialValue: ""
                }, (res) => { this.insertNodeResponse(res, state); });
            } else {
                S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    pendingEdit: true,
                    nodeId: parentNode.id,
                    newNodeName: "",
                    typeName: typeName || "u",
                    createAtTop,
                    content: null,
                    typeLock: false,
                    properties: null
                }, (res) => {
                    this.createSubNodeResponse(res, state);
                });
            }
        }
    }

    insertNodeResponse = (res: J.InsertNodeResponse, state: AppState): void => {
        if (S.util.checkSuccess("Insert node", res)) {
            S.meta64.updateNodeMap(res.newNode, state);
            S.meta64.highlightNode(res.newNode, false, state);
            this.runEditNode(null, res.newNode.id, false, false, state);
        }
    }

    createSubNodeResponse = (res: J.CreateSubNodeResponse, state: AppState): void => {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.meta64.refresh(state);
            }
            else {
                S.meta64.updateNodeMap(res.newNode, state);
                this.runEditNode(null, res.newNode.id, res.encrypt, false, state);
            }
        }
    }

    saveNodeResponse = async (node: J.NodeInfo, res: J.SaveNodeResponse, allowScroll: boolean, state: AppState): Promise<void> => {
        if (S.util.checkSuccess("Save node", res)) {
            await this.distributeKeys(node, res.aclEntries);

            // find and update the history item if it exists.
            let histItem: NodeHistoryItem = S.meta64.nodeHistory.find(function (h: NodeHistoryItem) {
                return h.id === node.id;
            });
            if (histItem) {
                histItem.content = S.util.getShortContent(node);
            }

            // It's possible to end up editing a node that's not even on the page, or a child of a node on the page,
            // and so before refreshing the screen we check for that edge case.
            // console.log("saveNodeResponse: " + S.util.prettyPrint(node));

            let parentPath = S.props.getParentPath(node);
            if (!parentPath) return;

            // I had expected the save to have already move into the non-pending folder by now,
            // but i haven't investigated yet, this must be right.
            if (parentPath.startsWith("/r/p")) {
                parentPath = S.util.replaceAll(parentPath, "/r/p", "/r");
            }

            // todo-1: is jumpToNode(id) always better regardless of infinite scroll mode? Before I imlemented the
            // infinite scroll this was doing the refreshTree, but I think refreshTree may actually be suboptimal.
            // todo-0: need to search for all 'refreshTree' calls and make sure they're all going to work
            // or identify others that would be better done by 'jumpToId' instead.
            if (C.TREE_INFINITE_SCROLL) {
                S.view.jumpToId(node.id);
            }
            else {
                S.view.refreshTree(null, false, false, node.id, false, allowScroll, false, state);
            }

            if (state.fullScreenCalendarId) {
                S.render.showCalendar(state.fullScreenCalendarId, state);
            }
        }
    }

    distributeKeys = async (node: J.NodeInfo, aclEntries: J.AccessControlInfo[]): Promise<void> => {
        if (!aclEntries || !S.props.isEncrypted(node)) {
            return;
        }

        for (let ac of aclEntries) {
            // console.log("Distribute Key to Principal: " + S.util.prettyPrint(ac));
            await S.share.addCipherKeyToNode(node, ac.publicKey, ac.principalNodeId);
        }
        // console.log("Key distribution complete.");
    }

    setRssHeadlinesOnly = async (state: AppState, val: boolean): Promise<void> => {
        state.userPreferences.rssHeadlinesOnly = val;
        S.meta64.saveUserPreferences(state);
    }

    toggleEditMode = async (state: AppState): Promise<void> => {
        state.userPreferences.editMode = !state.userPreferences.editMode;
        S.meta64.saveUserPreferences(state);

        /* scrolling is required because nodes will have scrolled out of view by the page just now updating */
        S.view.scrollToSelectedNode(state);
    }

    toggleShowMetaData = async (state: AppState): Promise<void> => {
        state.userPreferences.showMetaData = !state.userPreferences.showMetaData;
        S.meta64.saveUserPreferences(state);

        /* scrolling is required because nodes will have scrolled out of view by the page just now updating */
        S.view.scrollToSelectedNode(state);
    }

    moveNodeUp = (evt: Event, id: string, state?: AppState): void => {
        id = S.util.allowIdFromEvent(evt, id);
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        const node: J.NodeInfo = state.idToNodeMap.get(id);
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "up"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    moveNodeDown = (evt: Event, id: string, state: AppState): void => {
        id = S.util.allowIdFromEvent(evt, id);
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        const node: J.NodeInfo = state.idToNodeMap.get(id);
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "down"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    moveNodeToTop = (id: string = null, state: AppState = null): void => {
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        const node: J.NodeInfo = state.idToNodeMap.get(id);
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "top"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    moveNodeToBottom = (id: string = null, state: AppState = null): void => {
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        const node: J.NodeInfo = state.idToNodeMap.get(id);
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "bottom"
            }, (res) => {
                this.setNodePositionResponse(res, state);
            });
        }
    }

    getFirstChildNode = (state: AppState): any => {
        if (!state.node || !state.node.children || state.node.children.length === 0) return null;
        return state.node.children[0];
    }

    getLastChildNode = (state: AppState): any => {
        if (!state.node || !state.node.children || state.node.children.length === 0) return null;
        return state.node.children[state.node.children.length - 1];
    }

    runEditNodeByClick = (evt: Event, id: string, state?: AppState): void => {
        id = S.util.allowIdFromEvent(evt, id);

        // we set noScrollToId just to block the future attempt (one time) to
        // scroll to this, because this is a hint telling us we are ALREAY
        // scrolled to this ID so any scrolling will be unnecessary
        S.meta64.noScrollToId = id;
        this.runEditNode(null, id, false, false, state);
    }

    /* This can run as an actuall click event function in which only 'evt' is non-null here */
    runEditNode = (evt: Event, id: string, encrypt: boolean, showJumpButton: boolean, state?: AppState): void => {
        id = S.util.allowIdFromEvent(evt, id);

        state = appState(state);
        if (!id) {
            let node = S.meta64.getHighlightedNode(state);
            if (node) {
                id = node.id;
            }
        }

        if (!id) {
            S.util.showMessage("Unknown nodeId in editNodeClick: ", "Warning");
            return;
        }

        S.util.ajax<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            nodeId: id
        }, (res) => {
            this.initNodeEditResponse(res, encrypt, showJumpButton, state);
        });
    }

    toolbarInsertNode = (evt: Event, id: string): void => {
        id = S.util.allowIdFromEvent(evt, id);
        this.insertNode(id, null, 0);
    }

    insertNode = (id: string, typeName: string, ordinalOffset: number, state?: AppState): void => {
        state = appState(state);
        if (!state.node || !state.node.children) return;

        /*
         * We get the node selected for the insert position by using the uid if one was passed in or using the
         * currently highlighted node if no uid was passed.
         */
        let node: J.NodeInfo = null;
        if (!id) {
            node = S.meta64.getHighlightedNode(state);
        } else {
            node = state.idToNodeMap.get(id);
        }

        if (node) {
            S.meta64.newNodeTargetId = id;
            S.meta64.newNodeTargetOffset = ordinalOffset;
            this.startEditingNewNode(typeName, false, state.node, node, ordinalOffset, state);
        }
    }

    newSubNode = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const state = store.getState();
        if (S.meta64.ctrlKeyCheck()) {
            new ConfirmDlg("Paste your clipboard content into a new node?", "Create from Clipboard", //
                async () => {
                    // todo-2: document this feature under 'tips and tricks' in the user guide.
                    this.saveClipboardToChildNode(id);
                }, null, null, null, state
            ).open();
        }
        else {
            this.createSubNode(id, null, true, state.node, null);
        }
    }

    createSubNode = (id: any, typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, state: AppState): void => {
        state = appState(state);
        /*
         * If no uid provided we deafult to creating a node under the currently viewed node (parent of current page), or any selected
         * node if there is a selected node.
         */
        if (!id) {
            const node: J.NodeInfo = S.meta64.getHighlightedNode(state);
            if (node) {
                parentNode = node;
            }
            else {
                if (!state.node || !state.node.children) return null;
                parentNode = state.node;
            }
        } else {
            parentNode = state.idToNodeMap.get(id);
            if (!parentNode) {
                // console.log("Unknown nodeId in createSubNode: " + id);
                return;
            }
        }

        this.startEditingNewNode(typeName, createAtTop, parentNode, null, 0, state);
    }

    selectAllNodes = async (state: AppState): Promise<void> => {
        const highlightNode = S.meta64.getHighlightedNode(state);
        S.util.ajax<J.SelectAllNodesRequest, J.SelectAllNodesResponse>("selectAllNodes", {
            parentNodeId: highlightNode.id
        }, async (res: J.SelectAllNodesResponse) => {
            S.meta64.selectAllNodes(res.nodeIds);
        });
    }

    clearInbox = (state: AppState): void => {
        S.meta64.clearSelNodes(state);

        new ConfirmDlg("Permanently delete the nodes in your Inbox", "Cleaer Inbox",
            () => {
                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: ["~" + J.NodeType.INBOX],
                    childrenOnly: true
                }, (res: J.DeleteNodesResponse) => {
                    S.nav.openContentNode(state.homeNodePath, state);
                });
            }, null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    joinNodes = (state?: AppState): void => {
        state = appState(state);

        const selNodesArray = S.meta64.getSelNodeIdsArray(state);
        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("Select some nodes to join.", "Warning");
            return;
        }

        let confirmMsg = "Join " + selNodesArray.length + " node(s) ?";
        new ConfirmDlg(confirmMsg, "Confirm Join " + selNodesArray.length,
            () => {
                S.util.ajax<J.JoinNodesRequest, J.JoinNodesResponse>("joinNodes", {
                    nodeIds: selNodesArray
                }, (res: J.JoinNodesResponse) => {
                    this.joinNodesResponse(res, state);
                });
            },
            null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever the user
     * has currenly selected (via checkboxes)
     */
    deleteSelNodes = (evt: Event = null, id: string = null): void => {
        let state = store.getState();
        id = S.util.allowIdFromEvent(evt, id);

        // if a nodeId was specified we use it as the selected nodes to delete
        if (id) {
            // note we ARE updating 'state' here but it doesn't matter we can discard state, becasue
            // all we needed is selNodesArray which we get and as long as selNodesArray is preserved
            // we can let that change to 'state' get discarded in the next dispatch
            S.nav.setNodeSel(true, id, state);
        }
        const selNodesArray = S.meta64.getSelNodeIdsArray(state);

        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("Select some nodes to delete.", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.homeNodeId)) {
            S.util.showMessage("You can't delete your account root node!", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.node.id)) {
            S.util.showMessage("You can't delete your page node! Go up a level to do that.", "Warning");
            return;
        }

        let confirmMsg = "Delete " + selNodesArray.length + " node(s) ?";
        new ConfirmDlg(confirmMsg, "Confirm Delete " + selNodesArray.length,
            () => {
                let postDelSelNodeId: string = null;

                const node: J.NodeInfo = this.getBestPostDeleteSelNode(state);
                if (node) {
                    postDelSelNodeId = node.id;
                }

                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: selNodesArray,
                    childrenOnly: false
                }, (res: J.DeleteNodesResponse) => {
                    this.removeNodesFromHistory(selNodesArray, state);
                    this.removeNodesFromCalendarData(selNodesArray, state);

                    if (!postDelSelNodeId && !S.nav.displayingRepositoryRoot(state)) {
                        // we get here if user has deleted the last child (all children) of the parent of the current page
                        S.nav.navUpLevel(true);
                    } else {
                        this.deleteNodesResponse(res, postDelSelNodeId, state);
                    }

                    /* We waste a tiny bit of CPU/bandwidth here by just always updating the bookmarks in case
                     we just deleted some. This could be slightly improved to KNOW if we deleted any bookmarks, but
                    the added complexity to achieve that for recursive tree deletes doesn't pay off */
                    setTimeout(() => {
                        S.meta64.loadBookmarks();
                    }, 1000);
                });
            },
            null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    /* Updates 'nodeHistory' when nodes are deleted */
    removeNodesFromHistory = (selNodesArray: string[], appState: AppState) => {
        if (!selNodesArray) return;
        selNodesArray.forEach((id: string) => {
            // remove any top level history item that matches 'id'
            S.meta64.nodeHistory = S.meta64.nodeHistory.filter(function (h: NodeHistoryItem) {
                return h.id !== id;
            });

            // scan all top level history items, and remove 'id' from any subItems
            S.meta64.nodeHistory.forEach(function (h: NodeHistoryItem) {
                if (h.subItems) {
                    h.subItems = h.subItems.filter(function (hi: NodeHistoryItem) {
                        return hi.id !== id;
                    });
                }
            });
        });
    }

    removeNodesFromCalendarData = (selNodesArray: string[], appState: AppState) => {
        if (!appState.calendarData) return;

        selNodesArray.forEach((id: string) => {
            appState.calendarData = appState.calendarData.filter((item: EventInput) => item.id !== id);
        });

        // I'll leave this here commented until I actually TEST deleting calendar items again.
        // dispatch("Action_UpdateCalendarData", (s: AppState): AppState => {
        //     return appState;
        // });
    }

    /* Gets the node we want to scroll to after a delete, but if we're deleting the page root we return null,
    meaning we don't know which node to scroll to */
    getBestPostDeleteSelNode = (state: AppState): J.NodeInfo => {
        /* Use a hashmap-type approach to saving all selected nodes into a lookup map */
        const nodesToDelMap: Object = S.meta64.getSelNodesAsMapById(state);

        // If we are deleting the page root node return 'null' to trigger an 'upLevel'
        if (nodesToDelMap[state.node.id]) {
            return null;
        }

        let bestNode: J.NodeInfo = null;
        let takeNextNode: boolean = false;
        if (!state.node || !state.node.children) return null;

        /* now we scan the children, and the last child we encounterd up until we find the fist one in nodesMap will be the
        node we will want to select and scroll the user to AFTER the deleting is done */
        for (let i = 0; i < state.node.children.length; i++) {
            const node: J.NodeInfo = state.node.children[i];

            /* is this one of the nodes we'll be deleting */
            if (nodesToDelMap[node.id]) {
                takeNextNode = true;
            }
            else {
                if (takeNextNode) {
                    return node;
                }
                bestNode = node;
            }
        }
        return bestNode;
    }

    undoCutSelNodes = (): void => {
        dispatch("Action_SetNodesToMove", (s: AppState): AppState => {
            s.nodesToMove = null;
            return s;
        });
    }

    cutSelNodes = (evt: Event, id: string): void => {
        id = S.util.allowIdFromEvent(evt, null);

        dispatch("Action_SetNodesToMove", (s: AppState): AppState => {
            S.nav.setNodeSel(true, id, s);
            let selNodesArray = S.meta64.getSelNodeIdsArray(s);
            s.nodesToMove = selNodesArray;
            s.selectedNodes = {};
            return s;
        });
    }

    pasteSelNodesInside = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const state = appState();
        this.pasteSelNodes(id, "inside", state);
    }

    // location=inside | inline | inline-above (todo-2: put in java-aware enum)
    pasteSelNodes = (nodeId: string, location: string, state?: AppState): void => {
        state = appState(state);
        /*
         * For now, we will just cram the nodes onto the end of the children of the currently selected
         * page. Later on we can get more specific about allowing precise destination location for moved
         * nodes.
         */
        S.util.ajax<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId: nodeId,
            nodeIds: state.nodesToMove,
            location
        }, (res) => {
            this.moveNodesResponse(res, null, state);
        });
    }

    pasteSelNodes_InlineAbove = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline-above");
    }

    pasteSelNodes_Inline = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline");
    }

    insertBookWarAndPeace = (state: AppState): void => {
        new ConfirmDlg("Warning: You should have an EMPTY node selected now, to serve as the root node of the book!",
            "Confirm",
            () => {
                /* inserting under whatever node user has focused */
                const node = S.meta64.getHighlightedNode(state);

                if (!node) {
                    S.util.showMessage("No node is selected.", "Warning");
                } else {
                    S.util.ajax<J.InsertBookRequest, J.InsertBookResponse>("insertBook", {
                        nodeId: node.id,
                        bookName: "War and Peace",
                        truncated: S.user.isTestUserAccount(state)
                    }, (res) => { this.insertBookResponse(res, state); });
                }
            }, null, null, null, state
        ).open();
    }

    saveClipboardToChildNode = async (parentId: string): Promise<void> => {
        let clipText: string = await (navigator as any).clipboard.readText();

        // DO NOT DELETE (yet)
        // const items = await (navigator as any).clipboard.read();
        // for (let item of items) {
        //     const blob = await item.getType("text/html");
        //     if (blob) {
        //         let html = await blob.text();
        //         clipText = "```html\n" + html + "\n```\n";
        //         break;
        //     }
        // }

        if (clipText) {
            clipText = clipText.trim();
        }
        if (!clipText) {
            S.util.flashMessage("Nothing saved clipboard is empty!", "Warning", true);
            return;
        }

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: parentId,
            newNodeName: "",
            typeName: "u",
            createAtTop: true,
            content: clipText,
            typeLock: false,
            properties: null
        },
            () => {
                let message = parentId ? "Clipboard saved" : "Clipboard text saved under Notes node.";
                S.util.flashMessage(message + "...\n\n" + clipText, "Note", true);
                setTimeout(() => {
                    let state: AppState = store.getState();
                    S.view.refreshTree(null, true, false, null, false, true, true, state);
                }, 4200);
            });
    }

    splitNode = (node: J.NodeInfo, splitType: string, delimiter: string, state: AppState): void => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        if (!node) {
            S.util.showMessage("You didn't select a node to split.", "Warning");
            return;
        }

        S.util.ajax<J.SplitNodeRequest, J.SplitNodeResponse>("splitNode", {
            splitType: splitType,
            nodeId: node.id,
            delimiter
        }, (res) => {
            this.splitNodeResponse(res, state);
        });
    }

    splitNodeResponse = (res: J.SplitNodeResponse, state: AppState): void => {
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree(null, false, false, null, false, true, true, state);
            S.view.scrollToSelectedNode(state);
        }
    }

    addBookmark = (node: J.NodeInfo, state: AppState): void => {
        this.createNode(node, J.NodeType.BOOKMARK, true, null, null, state);
    }

    addLinkBookmark = (content: any, state: AppState): void => {
        state = appState(state);
        this.createNode(null, J.NodeType.BOOKMARK, true, "linkBookmark", content, state);
    }

    /* If node is non-null that means this is a reply to that 'node' but if node is 'null' that means
    this user just probably clicked "+" (new post button) on their Feed Tab and so we will let the server create some node
    like "My Posts" in the root of the user's account to host this new 'reply' by creating the new node under that */
    addNode = async (nodeId: string, content: string, state: AppState) => {
        state = appState(state);

        // auto-enable edit mode
        if (!state.userPreferences.editMode) {
            await S.edit.toggleEditMode(state);
        }

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: true,
            nodeId,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: false,
            content,
            typeLock: false,
            properties: null
        }, (res) => {
            this.createSubNodeResponse(res, state);
        });
    }

    createNode = (node: J.NodeInfo, typeName: string, pendingEdit: boolean, payloadType: string, content: string, state: AppState) => {
        state = appState(state);

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit,
            nodeId: node ? node.id : null,
            newNodeName: "",
            typeName,
            createAtTop: true,
            content,
            typeLock: true,
            properties: null,
            payloadType
        }, async (res) => {
            // auto-enable edit mode
            if (!state.userPreferences.editMode) {
                await S.edit.toggleEditMode(state);
            }
            this.createSubNodeResponse(res, state);
            return null;
        });
    }

    addCalendarEntry = (initDate: number, state: AppState) => {
        state = appState(state);

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: state.fullScreenCalendarId,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: null,
            typeLock: true,
            properties: [{ name: J.NodeProp.DATE, value: "" + initDate }]
        }, (res) => {
            this.createSubNodeResponse(res, state);
        });
    }

    moveNodeByDrop = (targetNodeId: string, sourceNodeId: string, isFirst: boolean): void => {
        /* if node being dropped on itself, then ignore */
        if (targetNodeId === sourceNodeId) {
            return;
        }

        // console.log("Moving node[" + targetNodeId + "] into position of node[" + sourceNodeId + "]");
        const state = appState(null);

        S.util.ajax<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId,
            nodeIds: [sourceNodeId],
            location: isFirst ? "inline-above" : "inline"
        }, (res) => {
            S.render.fadeInId = sourceNodeId;
            this.moveNodesResponse(res, sourceNodeId, state);
        });
    }

    updateHeadings = (state: AppState): void => {
        state = appState(state);
        const node: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (node) {
            S.util.ajax<J.UpdateHeadingsRequest, J.UpdateHeadingsResponse>("updateHeadings", {
                nodeId: node.id
            }, (res) => {
                S.meta64.refresh(state);
            });
        }
    }
}
