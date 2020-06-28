import * as J from "./JavaIntf";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { EditIntf } from "./intf/EditIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { AppState } from "./AppState";
import { dispatch, appState, store } from "./AppRedux";
import { ProfileDlg } from "./dlg/ProfileDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Edit implements EditIntf {

    showReadOnlyProperties: boolean = false;

    openProfileDlg = (state: AppState): void => {
        new ProfileDlg(state).open();
    }

    openChangePasswordDlg = (state: AppState): void => {
        new ChangePasswordDlg({}, state).open();
    }

    openManageAccountDlg = (state: AppState): void => {
        new ManageAccountDlg(state).open();
    }

    editPreferences = (state: AppState): void => {
        new PrefsDlg(state).open();
    }

    openImportDlg = (state: AppState): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        let dlg = new UploadFromFileDropzoneDlg(node.id, node, false, null, true, state, () => {
            S.meta64.refresh(state);
        });
        dlg.open();
    }

    openExportDlg = (state: AppState): void => {
        new ExportDlg(state).open();
    }

    private insertBookResponse = (res: J.InsertBookResponse, state: AppState): void => {
        console.log("insertBookResponse running.");
        S.util.checkSuccess("Insert Book", res);

        S.view.refreshTree(null, false, null, false, false, true, true, state);
        S.view.scrollToSelectedNode(state);
    }

    private deleteNodesResponse = (res: J.DeleteNodesResponse, postDeleteSelNodeId: string, state: AppState): void => {
        if (S.util.checkSuccess("Delete node", res)) {
            S.meta64.clearSelNodes(state);

            //We only want to pass a nodeId here if we are going to root node.
            let nodeId = postDeleteSelNodeId == state.homeNodeId ? postDeleteSelNodeId : null;

            S.view.refreshTree(nodeId, false, postDeleteSelNodeId, false, false, true, true, state);
        }
    }

    private initNodeEditResponse = (res: J.InitNodeEditResponse, state: AppState): void => {
        if (S.util.checkSuccess("Editing node", res)) {
            let node: J.NodeInfo = res.nodeInfo;

            let editingAllowed = this.isEditAllowed(node, state);

            if (editingAllowed) {
                /*
                 * Server will have sent us back the raw text content, that should be markdown instead of any HTML, so
                 * that we can display this and save.
                 */
                let editNode = res.nodeInfo;

                let dlg = new EditNodeDlg(editNode, state);
                dlg.open();
            } else {
                S.util.showMessage("You cannot edit nodes that you don't own.", "Warning");
            }
        }
    }

    private moveNodesResponse = (res: J.MoveNodesResponse, state: AppState): void => {
        if (S.util.checkSuccess("Move nodes", res)) {
            dispatch({
                type: "Action_SetNodesToMove", state,
                update: (s: AppState): void => {
                    s.nodesToMove = null;
                },
            });

            S.view.refreshTree(null, false, null, false, false, true, true, state);
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

        return state.userPreferences.editMode &&
            (state.isAdminUser || state.userName == owner);
        // /*
        //  * Check that if we have a commentBy property we are the commenter, before allowing edit button also.
        //  */
        // (!props.isNonOwnedCommentNode(node) || props.isOwnedCommentNode(node)) //
        // && !props.isNonOwnedNode(node);
    }

    isInsertAllowed = (node: J.NodeInfo, state: AppState): boolean => {
        //right now, for logged in users, we enable the 'new' button because the CPU load for determining it's enablement is too much, so
        //we throw an exception if they cannot. todo-1: need to make this work better.
        //however we CAN check if this node is an "admin" node and at least disallow any inserts under admin-owned nodess
        if (state.isAdminUser) return true;
        if (state.isAnonUser) return false;
        //console.log("isInsertAllowed: node.owner="+node.owner+" nodeI="+node.id);
        return node.owner != "admin";
    }

    /*
    * nodeInsertTarget holds the node that was clicked on at the time the insert was requested, and
    * is sent to server for ordinal position assignment of new node. Also if this var is null, it indicates we are
    * creating in a 'create under parent' mode, versus non-null meaning 'insert inline' type of insert.
    */
    startEditingNewNode = (typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, nodeInsertTarget: J.NodeInfo, ordinalOffset: number, state: AppState): void => {
        if (nodeInsertTarget) {
            S.util.ajax<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                parentId: parentNode.id,
                targetOrdinal: nodeInsertTarget.ordinal + ordinalOffset,
                newNodeName: "",
                typeName: typeName ? typeName : "u"
            }, (res) => { this.insertNodeResponse(res, state); });
        } else {
            S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                nodeId: parentNode.id,
                newNodeName: "",
                typeName: typeName ? typeName : "u",
                createAtTop: createAtTop,
                content: null,
                typeLock: false
            }, (res) => {
                this.createSubNodeResponse(res, state);
            });
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

    saveNodeResponse = async (node: J.NodeInfo, res: J.SaveNodeResponse, state: AppState): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (S.util.checkSuccess("Save node", res)) {
                await this.distributeKeys(node, res.aclEntries);
                S.view.refreshTree(null, false, node.id, false, false, false, false, state);
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
                let ac = aclEntries[i];

                // console.log("Distribute Key to Principal: " + S.util.prettyPrint(ac));
                await S.share.addCipherKeyToNode(node, ac.publicKey, ac.principalNodeId);
            }

            console.log("Key distribution complete.");

            resolve();
        });
    }

    toggleEditMode = async (state: AppState): Promise<void> => {
        state.userPreferences.editMode = state.userPreferences.editMode ? false : true;

        S.meta64.saveUserPreferences(state);

        dispatch({
            type: "Action_SetUserPreferences", state,
            update: (s: AppState): void => {
                s.userPreferences = state.userPreferences;
            }
        });
    }

    cached_moveNodeUp = (id: string, state?: AppState): void => {
        state = appState(state);
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        let node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "up"
            }, (res) => { this.setNodePositionResponse(res, state); });
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    cached_moveNodeDown = (id: string, state: AppState): void => {
        state = appState(state);
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }

        let node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "down"
            }, (res) => { this.setNodePositionResponse(res, state); });
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    moveNodeToTop = (id: string, state: AppState): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        let node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "top"
            }, (res) => { this.setNodePositionResponse(res, state); });
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    moveNodeToBottom = (id: string, state: AppState): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            id = selNode.id;
        }
        let node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: node.id,
                targetName: "bottom"
            }, (res) => {
                this.setNodePositionResponse(res, state);
            });
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    getFirstChildNode = (state: AppState): any => {
        if (!state.node || !state.node.children) return null;
        return state.node.children[0];
    }

    cached_runEditNode = (id: any, state?: AppState): void => {
        state = appState(state);
        let node: J.NodeInfo = null;
        if (!id) {
            node = S.meta64.getHighlightedNode(state);
        }
        else {
            node = state.idToNodeMap[id];
        }

        if (!node) {
            S.util.showMessage("Unknown nodeId in editNodeClick: " + id, "Warning");
            return;
        }

        S.util.ajax<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            nodeId: node.id
        }, (res) => {
            this.initNodeEditResponse(res, state);
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

    /* Need all cached functions to be prefixed so they're recognizable, since refactoring them can break things */
    cached_newSubNode = (id: any) => {
        let state = store.getState();
        this.createSubNode(id, null, true, state.node, null);
    }

    createSubNode = (id: any, typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, state: AppState): void => {
        state = appState(state);
        /*
         * If no uid provided we deafult to creating a node under the currently viewed node (parent of current page), or any selected
         * node if there is a selected node.
         */
        if (!id) {
            let highlightNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
            if (highlightNode) {
                parentNode = highlightNode;
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
        let highlightNode = S.meta64.getHighlightedNode(state);
        S.util.ajax<J.SelectAllNodesRequest, J.SelectAllNodesResponse>("selectAllNodes", {
            parentNodeId: highlightNode.id
        }, async (res: J.SelectAllNodesResponse) => {
            console.log("Node Sel Count: " + res.nodeIds.length);
            S.meta64.selectAllNodes(res.nodeIds);
        });
    }

    emptyTrash = (state: AppState): void => {
        S.meta64.clearSelNodes(state);

        new ConfirmDlg("Permanently delete your entire Trash Bin", "Empty Trash",
            () => {
                //do not delete (see note above)
                //let postDeleteSelNode: J.NodeInfo = this.getBestPostDeleteSelNode();

                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: [state.homeNodePath + "/d"],
                    hardDelete: true
                }, (res: J.DeleteNodesResponse) => {
                    //if user was viewing trash when the deleted it that's a proble, so for now the short term
                    //solution is send user to their root now.
                    S.nav.openContentNode(state.homeNodePath, state);

                    //do not delete (see note above)
                    //this.deleteNodesResponse(res, { "postDeleteSelNode": postDeleteSelNode });
                });
            }, null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    clearInbox = (state: AppState): void => {
        S.meta64.clearSelNodes(state);

        new ConfirmDlg("Permanently delete your entire Inbox", "Cleaer Inbox",
            () => {
                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: ["~" + J.NodeType.INBOX],
                    hardDelete: true
                }, (res: J.DeleteNodesResponse) => {
                    S.nav.openContentNode(state.homeNodePath, state);
                });
            }, null, "btn-danger", "alert alert-danger", state
        ).open();
    }

    cached_softDeleteSelNodes = (nodeId: string) => {
        this.deleteSelNodes(nodeId, false);
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever the user
     * has currenly selected (via checkboxes)
     */
    deleteSelNodes = (nodeId: string, hardDelete: boolean, state?: AppState): void => {
        state = appState(state);
        if (nodeId) {
            S.nav.setNodeSel(true, nodeId, state);
        }
        let selNodesArray = S.meta64.getSelNodeIdsArray(state);

        if (!selNodesArray || selNodesArray.length == 0) {
            S.util.showMessage("You have not selected any nodes to delete.", "Warning");
            return;
        }

        let failMsg = null;
        if (selNodesArray.find(id => id == state.homeNodeId)) {
            failMsg = "Sorry, you can't delete your account root node!";
        }

        let postDeleteSelNodeId: string = null;

        /* if one of the nodes being deleted is the page root, then render the account root, rather than trying to find ist's parent */
        if (selNodesArray.find(id => id == state.node.id)) {
            postDeleteSelNodeId = state.homeNodeId;
        }

        if (failMsg) {
            S.util.showMessage(failMsg, "Warning");
            return;
        }

        let firstNodeId: string = selNodesArray[0];

        /* todo-1: would be better to check if ANY of the nodes are deleted not just arbitary first one */
        let nodeCheck: J.NodeInfo = state.idToNodeMap[firstNodeId];
        let confirmMsg = null;
        if (nodeCheck.deleted || hardDelete) {
            confirmMsg = "Permanently Delete " + selNodesArray.length + " node(s) ?"
        }
        else {
            confirmMsg = "Move " + selNodesArray.length + " node(s) to the trash bin ?";
        }

        new ConfirmDlg(confirmMsg, "Confirm Delete " + selNodesArray.length,
            () => {
                if (!postDeleteSelNodeId) {
                    let node: J.NodeInfo = this.getBestPostDeleteSelNode(state);
                    if (node) {
                        postDeleteSelNodeId = node.id;
                    }
                }

                if (!postDeleteSelNodeId) {
                    postDeleteSelNodeId = state.homeNodeId;
                }
                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: selNodesArray,
                    hardDelete
                }, (res: J.DeleteNodesResponse) => {
                    this.deleteNodesResponse(res, postDeleteSelNodeId, state);
                });
            },
            null, //no callback
            (nodeCheck.deleted || hardDelete) ? "btn-danger" : null,
            (nodeCheck.deleted || hardDelete) ? "alert alert-danger" : null,
            state
        ).open();
    }

    /* Gets the node we want to scroll to after a delete */
    getBestPostDeleteSelNode = (state: AppState): J.NodeInfo => {
        /* Use a hashmap-type approach to saving all selected nodes into a lookup map */
        let nodesMap: Object = S.meta64.getSelNodesAsMapById(state);

        //If we are deleting the page root node return 'null' to trigger an 'upLevel'
        if (nodesMap[state.node.id]) {
            return null;
        }

        let bestNode: J.NodeInfo = null;
        let takeNextNode: boolean = false;
        if (!state.node || !state.node.children) return null;

        /* now we scan the children, and the last child we encounterd up until we find the rist one in nodesMap will be the
        node we will want to select and scroll the user to AFTER the deleting is done */
        for (let i = 0; i < state.node.children.length; i++) {
            let node: J.NodeInfo = state.node.children[i];

            /* is this node one to be deleted */
            if (nodesMap[node.id]) {
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
            type: "Action_SetNodesToMove", state,
            update: (s: AppState): void => {
                s.nodesToMove = null;
            }
        });
    }

    cached_cutSelNodes = (nodeId: string, state?: AppState): void => {
        state = appState(state);

        S.nav.setNodeSel(true, nodeId, state);
        let selNodesArray = S.meta64.getSelNodeIdsArray(state);

        new ConfirmDlg("Cut " + selNodesArray.length + " node(s), to paste/move to new location ?", "Confirm Cut",
            async () => {
                dispatch({
                    type: "Action_SetNodesToMove", state,
                    update: (s: AppState): void => {
                        s.nodesToMove = selNodesArray;
                    }
                });
                state.selectedNodes = {}; // clear selections.

            }, null, null, null, state
        ).open();
    }

    cached_pasteSelNodesInside = (nodeId: string) => {
        let state = appState();
        this.pasteSelNodes(nodeId, 'inside', state);
    }

    //location=inside | inline | inline-above (todo-1: put in java-aware enum)
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
            this.moveNodesResponse(res, state);
        });
    }

    cached_pasteSelNodes_InlineEnd = (nodeId: string) => {
        this.pasteSelNodes(nodeId, "inline-end");
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
                let node = S.meta64.getHighlightedNode(state);

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

    saveClipboardToNode = (): void => {
        (navigator as any).clipboard.readText().then(
            clipText => {
                if (clipText) {
                    clipText = clipText.trim();
                }
                if (!clipText) {
                    S.util.flashMessage("Nothing saved clipboard is empty!", "Warning", true);
                    return;
                }

                S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    nodeId: "~" + J.NodeType.NOTES,
                    newNodeName: "",
                    typeName: "u",
                    createAtTop: true,
                    content: clipText,
                    typeLock: false
                },
                    () => {
                        S.util.flashMessage("Clipboard content saved under your Notes node...\n\n" + clipText, "Note", true);
                    }
                );
            });
    }

    splitNode = (splitType: string, delimiter: string, state: AppState): void => {
        let highlightNode = S.meta64.getHighlightedNode(state);
        if (!highlightNode) {
            S.util.showMessage("You didn't select a node to split.", "Warning");
            return;
        }

        S.util.ajax<J.SplitNodeRequest, J.SplitNodeResponse>("splitNode", {
            splitType: splitType,
            nodeId: highlightNode.id,
            delimiter
        }, (res) => {
            this.splitNodeResponse(res, state);
        });
    }

    splitNodeResponse = (res: J.SplitNodeResponse, state: AppState): void => {
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree(null, false, null, false, false, true, true, state);
            S.view.scrollToSelectedNode(state);
        }
    }

    addComment = (node: J.NodeInfo, state: AppState) => {
        state = appState(state);

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            nodeId: node.id,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: false,
            content: null,
            typeLock: false
        }, (res) => {
            this.createSubNodeResponse(res, state);
        });
    }

    addFriend = (node: J.NodeInfo, state: AppState) => {
        state = appState(state);

        S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            nodeId: node.id,
            newNodeName: "",
            typeName: J.NodeType.FRIEND,
            createAtTop: true,
            content: null,
            typeLock: true
        }, (res) => {
            this.createSubNodeResponse(res, state);
        });
    }
}
