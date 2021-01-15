import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { ProfileDlg } from "./dlg/ProfileDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { EditIntf } from "./intf/EditIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { EventInput } from "@fullcalendar/react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Edit implements EditIntf {

    showReadOnlyProperties: boolean = false;

    openProfileDlg = (state: AppState): void => {
        new ProfileDlg(state, false, null, null).open();
    }

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

        const dlg = new UploadFromFileDropzoneDlg(node.id, node, "", false, null, true, true, state, () => {
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
            S.meta64.clearSelNodes(state);

            // We only want to pass a nodeId here if we are going to root node.
            const nodeId = postDelSelNodeId === state.homeNodeId ? postDelSelNodeId : null;

            S.view.refreshTree(nodeId, false, false, postDelSelNodeId, false, true, true, state);
        }
    }

    public initNodeEditResponse = (res: J.InitNodeEditResponse, state: AppState, dialogEditor: boolean): void => {
        if (S.util.checkSuccess("Editing node", res)) {
            const node: J.NodeInfo = res.nodeInfo;

            const editingAllowed = this.isEditAllowed(node, state);
            if (editingAllowed) {
                /*
                 * Server will have sent us back the raw text content, that should be markdown instead of any HTML, so
                 * that we can display this and save.
                 */
                const editNode = res.nodeInfo;

                if (dialogEditor) {
                    const dlg = new EditNodeDlg(editNode, state);
                    dlg.open();
                }
                else {
                    dispatch({
                        type: "Action_InlineEdit",
                        update: (s: AppState): void => {
                            s.inlineEditId = node.id;
                            s.inlineEditVal = node.content;
                        }
                    });
                }
            } else {
                /* todo-0: when edit mode is not on, and a user tries to use the social 'reply' button this error comes up
                which is completely wrong an misleading in that context. */
                S.util.showMessage("You cannot edit nodes that you don't own.", "Warning");
            }
        }
    }

    /* nodeId is optional and represents what to highlight after the paste if anything */
    private moveNodesResponse = (res: J.MoveNodesResponse, nodeId: string, state: AppState): void => {
        if (S.util.checkSuccess("Move nodes", res)) {
            dispatch({
                type: "Action_SetNodesToMove",
                state,
                update: (s: AppState): void => {
                    s.nodesToMove = null;
                }
            });

            S.view.refreshTree(null, false, false, nodeId, false, true, true, state);
        }
    }

    private setNodePositionResponse = (res: J.SetNodePositionResponse, state: AppState): void => {
        if (S.util.checkSuccess("Change node position", res)) {
            S.meta64.refresh(state);
        }
    }

    /* returns true if we can 'try to' insert under 'node' or false if not */
    isEditAllowed = (node: any, state: AppState): boolean => {
        let owner: string = node.owner;

        // if we don't know who owns this node assume the admin owns it.
        if (!owner) {
            owner = "admin";
        }

        // if this node is admin owned, and we aren't the admin, then just disable editing. Admin himself is not even allowed to
        // make nodes editable by any other user.
        if (owner === "admin" && !state.isAdminUser) return false;

        return state.userPreferences.editMode &&
            (state.isAdminUser || state.userName === owner);
        // /*
        //  * Check that if we have a commentBy property we are the commenter, before allowing edit button also.
        //  */
        // (!props.isNonOwnedCommentNode(node) || props.isOwnedCommentNode(node)) //
        // && !props.isNonOwnedNode(node);
    }

    isInsertAllowed = (node: J.NodeInfo, state: AppState): boolean => {
        if (state.homeNodeId === node.id) {
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
        // we throw an exception if they cannot. todo-1: need to make this work better.
        // however we CAN check if this node is an "admin" node and at least disallow any inserts under admin-owned nodess
        if (state.isAdminUser) return true;
        if (state.isAnonUser) return false;
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
            console.log("Rejecting request to edit. Not authorized");
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
            S.meta64.highlightNode(res.newNode, true, state);
            this.cached_runEditNode(res.newNode.id, state);
        }
    }

    createSubNodeResponse = (res: J.CreateSubNodeResponse, state: AppState): void => {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.meta64.refresh(state);
            }
            else {
                S.meta64.updateNodeMap(res.newNode, state);
                this.cached_runEditNode(res.newNode.id, state);
            }
        }
    }

    saveNodeResponse = async (node: J.NodeInfo, res: J.SaveNodeResponse, allowScroll: boolean, state: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (S.util.checkSuccess("Save node", res)) {
                await this.distributeKeys(node, res.aclEntries);
                S.view.refreshTree(null, false, false, node.id, false, allowScroll, false, state);
                if (state.fullScreenCalendarId) {
                    S.render.showCalendar(state.fullScreenCalendarId, state);
                }
                resolve();
            }
        });
    }

    distributeKeys = async (node: J.NodeInfo, aclEntries: J.AccessControlInfo[]): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (!aclEntries || !S.props.isEncrypted(node)) {
                resolve();
                return;
            }

            for (let i = 0; i < aclEntries.length; i++) {
                const ac = aclEntries[i];
                // console.log("Distribute Key to Principal: " + S.util.prettyPrint(ac));
                await S.share.addCipherKeyToNode(node, ac.publicKey, ac.principalNodeId);
            }

            console.log("Key distribution complete.");
            resolve();
        });
    }

    toggleEditMode = async (state: AppState): Promise<void> => {
        state.userPreferences.editMode = !state.userPreferences.editMode;
        S.meta64.saveUserPreferences(state);

        dispatch({
            type: "Action_SetUserPreferences",
            state,
            update: (s: AppState): void => {
                s.userPreferences = state.userPreferences;
            }
        });
    }

    toggleShowMetaData = async (state: AppState): Promise<void> => {
        state.userPreferences.showMetaData = !state.userPreferences.showMetaData;
        S.meta64.saveUserPreferences(state);

        dispatch({
            type: "Action_SetUserPreferences",
            state,
            update: (s: AppState): void => {
                s.userPreferences = state.userPreferences;
            }
        });
    }

    cached_moveNodeUp = (id: string, state?: AppState): void => {
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        const node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "up"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    cached_moveNodeDown = (id: string, state: AppState): void => {
        state = appState(state);
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        const node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "down"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    moveNodeToTop = (id: string, state: AppState): void => {
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        const node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "top"
            }, (res) => { this.setNodePositionResponse(res, state); });
        }
    }

    moveNodeToBottom = (id: string, state: AppState): void => {
        if (!id) {
            const selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        const node: J.NodeInfo = state.idToNodeMap[id];
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

    cached_runEditNode = (id: any, state?: AppState): void => {
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
            this.initNodeEditResponse(res, state, true);
        });
    }

    cached_toolbarInsertNode = (id: string): void => {
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
            node = state.idToNodeMap[id];
        }

        if (node) {
            this.startEditingNewNode(typeName, false, state.node, node, ordinalOffset, state);
        }
    }

    cached_newSubNode = (id: string) => {
        const state = store.getState();
        if (S.meta64.ctrlKeyCheck()) {
            new ConfirmDlg("Paste your clipboard content into a new node?", "Create from Clipboard", //
                async () => {
                    // todo-1: document this feature under 'tips and tricks' in the user guide.
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
            parentNode = state.idToNodeMap[id];
            if (!parentNode) {
                console.log("Unknown nodeId in createSubNode: " + id);
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

    cached_deleteSelNodes = (nodeId: string) => {
        this.deleteSelNodes(nodeId);
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever the user
     * has currenly selected (via checkboxes)
     */
    deleteSelNodes = (nodeId: string, state?: AppState): void => {
        state = appState(state);

        // if a nodeId was specified we use it as the selected nodes to delete
        if (nodeId) {
            S.nav.setNodeSel(true, nodeId, state);
        }
        const selNodesArray = S.meta64.getSelNodeIdsArray(state);

        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("You have not selected any nodes to delete.", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.homeNodeId)) {
            S.util.showMessage("You can't delete your account root node! To close your account use the Account Menu", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.node.id)) {
            S.util.showMessage("You can't delete your page node! Go up a level to do that.", "Warning");
            return;
        }

        const firstNodeId: string = selNodesArray[0];

        /* todo-1: would be better to check if ANY of the nodes are deleted not just arbitary first one */
        const nodeCheck: J.NodeInfo = state.idToNodeMap[firstNodeId];
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

                    this.removeNodesFromCalendarData(selNodesArray, state);

                    if (!postDelSelNodeId && !S.nav.displayingRepositoryRoot(state)) {
                        // we get here if user has deleted the last child (all chidren) of the parent of the current page
                        S.nav.navUpLevel();
                    } else {
                        this.deleteNodesResponse(res, postDelSelNodeId, state);
                    }
                });
            },
            null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    removeNodesFromCalendarData = (selNodesArray: string[], appState: AppState) => {
        if (!appState.calendarData) return;

        selNodesArray.forEach((id: string) => {
            appState.calendarData = appState.calendarData.filter((item: EventInput) => item.id !== id);
        });

        dispatch({
            type: "Action_UpdateCalendarData",
            update: (s: AppState): void => {
                s.calendarData = appState.calendarData;
            }
        });
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

    undoCutSelNodes = async (state: AppState): Promise<void> => {
        dispatch({
            type: "Action_SetNodesToMove",
            state,
            update: (s: AppState): void => {
                s.nodesToMove = null;
            }
        });
    }

    cached_cutSelNodes = (nodeId: string, state?: AppState): void => {
        state = appState(state);

        S.nav.setNodeSel(true, nodeId, state);
        const selNodesArray = S.meta64.getSelNodeIdsArray(state);

        dispatch({
            type: "Action_SetNodesToMove",
            state,
            update: (s: AppState): void => {
                s.nodesToMove = selNodesArray;
            }
        });
        state.selectedNodes = {};
    }

    cached_pasteSelNodesInside = (nodeId: string) => {
        const state = appState();
        this.pasteSelNodes(nodeId, "inside", state);
    }

    // location=inside | inline | inline-above (todo-1: put in java-aware enum)
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

    cached_pasteSelNodes_InlineAbove = (nodeId: string) => {
        this.pasteSelNodes(nodeId, "inline-above");
    }

    cached_pasteSelNodes_Inline = (nodeId: string) => {
        this.pasteSelNodes(nodeId, "inline");
    }

    insertBookWarAndPeace = (state: AppState): void => {
        new ConfirmDlg("Insert book War and Peace?<p/>Warning: You should have an EMPTY node selected now, to serve as the root node of the book!",
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

    /* If node is non-null that means this is a reply to that 'node' but if node is 'null' that means
    this user just probably clicked "New Post" on their Feed Tab and so we will let the server create some node
    like "My Posts" in the root of the user's account to host this new 'reply' by creating the new node under that */
    addComment = async (node: J.NodeInfo, state: AppState) => {
        state = appState(state);

        // auto-enable edit mode
        if (!state.userPreferences.editMode) {
            await S.edit.toggleEditMode(state);
        }

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: true,
            nodeId: node ? node.id : null,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: false,
            content: null,
            typeLock: false,
            properties: null
        }, (res) => {
            this.createSubNodeResponse(res, state);
        });
    }

    /* This starts editing an actual Friend Node that when the user is presumably editing inside their FRIENDS_LIST node */
    addFriend = (node: J.NodeInfo, state: AppState) => {
        state = appState(state);

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: node.id,
            newNodeName: "",
            typeName: J.NodeType.FRIEND,
            createAtTop: true,
            content: null,
            typeLock: true,
            properties: null
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
            typeName: J.NodeType.CALENDAR_ENTRY,
            createAtTop: true,
            content: null,
            typeLock: true,
            properties: [{ name: "date", value: "" + initDate }]
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
