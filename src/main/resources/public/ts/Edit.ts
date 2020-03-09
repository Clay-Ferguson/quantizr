import * as J from "./JavaIntf";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { CreateNodeDlg } from "./dlg/CreateNodeDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { ImportFromFileDropzoneDlg } from "./dlg/ImportFromFileDropzoneDlg";
import { EditIntf } from "./intf/EditIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Edit implements EditIntf {

    /* Node being uploaded to */
    importTargetNode: any = null;

    showReadOnlyProperties: boolean = true;
    /*
     * Node ID array of nodes that are ready to be moved when user clicks 'Finish Moving'
     */
    nodesToMove: any = null;

    /* todo-1: need to find out if there's a better way to do an ordered set in javascript so I don't need
    both nodesToMove and nodesToMoveSet
    */
    nodesToMoveSet: Object = {};

    parentOfNewNode: J.NodeInfo = null;

    /*
     * type=NodeInfo.java
     *
     * When inserting a new node, this holds the node that was clicked on at the time the insert was requested, and
     * is sent to server for ordinal position assignment of new node. Also if this var is null, it indicates we are
     * creating in a 'create under parent' mode, versus non-null meaning 'insert inline' type of insert.
     *
     */
    nodeInsertTarget: any = null;

    createNode = (): void => {
        new CreateNodeDlg().open();
    }

    openChangePasswordDlg = (): void => {
        new ChangePasswordDlg({}).open();
    }

    openManageAccountDlg = (): void => {
        new ManageAccountDlg().open();
    }

    editPreferences = (): void => {
        new PrefsDlg().open();
    }

    openImportDlg = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();
        if (!node) {
            this.importTargetNode = null;
            S.util.showMessage("No node is selected.");
            return;
        }

        this.importTargetNode = node;

        new ImportFromFileDropzoneDlg().open();

        /* This dialog is no longer needed, now that we support uploading from a stream. This older dialog imports a file
        as specified by the admin by filename, but has the limitation of requiring that file to already exist
        in the server admin folder ON the actual server where the webapp is running.
        Factory.createDefault("ImportDlgImpl", (dlg: ImportDlg) => {
            dlg.open();
        })
        */
    }

    openExportDlg = (): void => {
        new ExportDlg().open();
    }

    private insertBookResponse = (res: J.InsertBookResponse): void => {
        console.log("insertBookResponse running.");
        S.util.checkSuccess("Insert Book", res);

        S.view.refreshTree(null, false);
        S.meta64.selectTab("mainTab");
        S.view.scrollToSelectedNode();
    }

    private deleteNodesResponse = (res: J.DeleteNodesResponse, payload: Object): void => {
        if (S.util.checkSuccess("Delete node", res)) {
            S.meta64.clearSelectedNodes();
            let highlightId: string = null;
            if (payload) {
                let selNode = payload["postDeleteSelNode"];
                if (selNode) {
                    highlightId = selNode.id;
                }
            }

            S.view.refreshTree(null, false, highlightId);
        }
    }

    private initNodeEditResponse = (res: J.InitNodeEditResponse): void => {
        if (S.util.checkSuccess("Editing node", res)) {
            let node: J.NodeInfo = res.nodeInfo;

            // /* if this is a comment node and we are the commenter */
            // let editingAllowed: boolean = props.isOwnedCommentNode(node);

            // if (!editingAllowed) {
            //     editingAllowed = meta64.isAdminUser || (!props.isNonOwnedCommentNode(node)
            //         && !props.isNonOwnedNode(node));
            // }
            let editingAllowed = this.isEditAllowed(node);

            if (editingAllowed) {
                /*
                 * Server will have sent us back the raw text content, that should be markdown instead of any HTML, so
                 * that we can display this and save.
                 */
                let editNode = res.nodeInfo;

                let dlg = new EditNodeDlg(editNode);
                dlg.open();
            } else {
                S.util.showMessage("You cannot edit nodes that you don't own.");
            }
        }
    }

    private moveNodesResponse = (res: J.MoveNodesResponse): void => {
        if (S.util.checkSuccess("Move nodes", res)) {
            this.nodesToMove = null; // reset
            this.nodesToMoveSet = {};
            S.view.refreshTree(null, false);
        }
    }

    private setNodePositionResponse = (res: J.SetNodePositionResponse): void => {
        if (S.util.checkSuccess("Change node position", res)) {
            S.meta64.refresh();
        }
    }

    /* returns true if we can 'try to' insert under 'node' or false if not */
    isEditAllowed = (node: any): boolean => {
        let owner: string = node.owner;

        // if we don't know who owns this node assume the admin owns it.
        if (!owner) {
            owner = "admin";
        }

        return S.meta64.userPreferences.editMode &&
            (S.meta64.isAdminUser || S.meta64.userName == owner);
        // /*
        //  * Check that if we have a commentBy property we are the commenter, before allowing edit button also.
        //  */
        // (!props.isNonOwnedCommentNode(node) || props.isOwnedCommentNode(node)) //
        // && !props.isNonOwnedNode(node);
    }

    isInsertAllowed = (node: J.NodeInfo): boolean => {
        //right now, for logged in users, we enable the 'new' button because the CPU load for determining it's enablement is too much, so
        //we throw an exception if they cannot. todo-1: need to make this work better.
        //however we CAN check if this node is an "admin" node and at least disallow any inserts under admin-owned nodess
        if (S.meta64.isAdminUser) return true;
        if (S.meta64.isAnonUser) return false;
        //console.log("isInsertAllowed: node.owner="+node.owner+" nodeI="+node.id);
        return node.owner != "admin";
    }

    startEditingNewNode = (typeName?: string, createAtTop?: boolean): void => {
        /*
         * If we didn't create the node we are inserting under, and neither did "admin", then we need to send notification
         * email upon saving this new node.
         */
        // if (S.meta64.userName != S.edit.parentOfNewNode.owner && //
        //     S.edit.parentOfNewNode.owner != "admin") {
        //     S.edit.sendNotificationPendingSave = true;
        // }


        if (S.edit.nodeInsertTarget) {
            S.util.ajax<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                "parentId": S.edit.parentOfNewNode.id,
                "targetOrdinal": S.edit.nodeInsertTarget.ordinal,
                "newNodeName": "",
                "typeName": typeName ? typeName : "u"
            }, S.edit.insertNodeResponse);
        } else {
            S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                "nodeId": S.edit.parentOfNewNode.id,
                "newNodeName": "",
                "typeName": typeName ? typeName : "u",
                "createAtTop": createAtTop,
                "content": null
            }, S.edit.createSubNodeResponse);
        }
    }

    insertNodeResponse = (res: J.InsertNodeResponse): void => {
        if (S.util.checkSuccess("Insert node", res)) {
            S.meta64.initNode(res.newNode, true);
            S.meta64.highlightNode(res.newNode, true);
            this.runEditNode(res.newNode.id);
        }
    }

    createSubNodeResponse = (res: J.CreateSubNodeResponse): void => {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.meta64.refresh();
            }
            else {
                S.meta64.initNode(res.newNode, true);
                this.runEditNode(res.newNode.id);
            }
        }
    }

    saveNodeResponse = async (node: J.NodeInfo, res: J.SaveNodeResponse): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            if (S.util.checkSuccess("Save node", res)) {
                await this.distributeKeys(node, res.aclEntries);

                S.view.refreshTree(null, false, node.id);
                S.meta64.selectTab("mainTab");
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

    editMode = async (modeVal?: boolean): Promise<void> => {
        if (typeof modeVal != 'undefined') {
            S.meta64.userPreferences.editMode = modeVal;
        }
        else {
            S.meta64.userPreferences.editMode = S.meta64.userPreferences.editMode ? false : true;
        }

        S.meta64.saveUserPreferences();
        await S.render.renderPageFromData();
    }

    moveNodeUp = (id?: string): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode();
            id = selNode.id;
        }

        let node: J.NodeInfo = S.meta64.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "up"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    moveNodeDown = (id?: string): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode();
            id = selNode.id;
        }

        let node: J.NodeInfo = S.meta64.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "down"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    moveNodeToTop = (id?: string): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode();
            id = selNode.id;
        }
        let node: J.NodeInfo = S.meta64.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "top"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    moveNodeToBottom = (id?: string): void => {
        if (!id) {
            let selNode: J.NodeInfo = S.meta64.getHighlightedNode();
            id = selNode.id;
        }
        let node: J.NodeInfo = S.meta64.idToNodeMap[id];
        if (node) {
            S.util.ajax<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "bottom"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + id);
        }
    }

    /*
     * Returns the node above the specified node or null if node is itself the top node
     */
    getNodeAbove = (node: J.NodeInfo): any => {
        if (!S.meta64.currentNodeData) return null;
        let ordinal: number = S.meta64.getOrdinalOfNode(node);
        if (ordinal <= 0)
            return null;
        return S.meta64.currentNodeData.node.children[ordinal - 1];
    }

    /*
     * Returns the node below the specified node or null if node is itself the bottom node
     */
    getNodeBelow = (node: J.NodeInfo): J.NodeInfo => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;
        let ordinal: number = S.meta64.getOrdinalOfNode(node);
        console.log("ordinal = " + ordinal);
        if (ordinal == -1 || ordinal >= S.meta64.currentNodeData.node.children.length - 1)
            return null;

        return S.meta64.currentNodeData.node.children[ordinal + 1];
    }

    getFirstChildNode = (): any => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;
        return S.meta64.currentNodeData.node.children[0];
    }

    runEditNode = (id: any): void => {
        let node: J.NodeInfo = null;
        if (!id) {
            node = S.meta64.getHighlightedNode();
        }
        else {
            node = S.meta64.idToNodeMap[id];
        }

        if (!node) {
            S.util.showMessage("Unknown nodeId in editNodeClick: " + id);
            return;
        }

        S.util.ajax<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            "nodeId": node.id
        }, this.initNodeEditResponse);
    }

    insertNode = (id?: any, typeName?: string): void => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return;
        this.parentOfNewNode = S.meta64.currentNodeData.node;
        if (!this.parentOfNewNode) {
            console.log("Unknown parent");
            return;
        }

        /*
         * We get the node selected for the insert position by using the uid if one was passed in or using the
         * currently highlighted node if no uid was passed.
         */
        let node: J.NodeInfo = null;
        if (!id) {
            node = S.meta64.getHighlightedNode();
        } else {
            node = S.meta64.idToNodeMap[id];
        }

        if (node) {
            this.nodeInsertTarget = node;
            this.startEditingNewNode(typeName);
        }
    }

    createSubNode = (id?: any, typeName?: string, createAtTop?: boolean): void => {
        /*
         * If no uid provided we deafult to creating a node under the currently viewed node (parent of current page), or any selected
         * node if there is a selected node.
         */
        if (!id) {
            let highlightNode: J.NodeInfo = S.meta64.getHighlightedNode();
            if (highlightNode) {
                this.parentOfNewNode = highlightNode;
            }
            else {
                if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;
                this.parentOfNewNode = S.meta64.currentNodeData.node;
            }
        } else {
            this.parentOfNewNode = S.meta64.idToNodeMap[id];
            if (!this.parentOfNewNode) {
                console.log("Unknown nodeId in createSubNode: " + id);
                return;
            }
        }

        /*
         * this indicates we are NOT inserting inline. An inline insert would always have a target.
         */
        this.nodeInsertTarget = null;
        this.startEditingNewNode(typeName, createAtTop);
    }

    selectAllNodes = async (): Promise<void> => {
        let highlightNode = S.meta64.getHighlightedNode();
        S.util.ajax<J.SelectAllNodesRequest, J.SelectAllNodesResponse>("selectAllNodes", {
            "parentNodeId": highlightNode.id
        }, async (res: J.SelectAllNodesResponse) => {
            console.log("Node Sel Count: " + res.nodeIds.length);
            S.meta64.selectAllNodes(res.nodeIds);

            //optimization is possible here (todo-1) to simply set the checkbox values of each one
            //rather than rendering entire page again.
            await S.render.renderPageFromData();
        });
    }

    clearSelections = async (): Promise<void> => {
        S.meta64.clearSelectedNodes();

        /*
         * We could write code that only scans for all the "SEL" buttons and updates the state of them, but for now
         * we take the simple approach and just re-render the page. There is no call to the server, so this is
         * actually very efficient.
         */

        await S.render.renderPageFromData();
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever the user
     * has currenly selected (via checkboxes)
     */
    deleteSelNodes = (selNodesArray: string[]): void => {
        selNodesArray = selNodesArray || S.meta64.getSelectedNodeIdsArray();

        if (!selNodesArray || selNodesArray.length == 0) {
            S.util.showMessage("You have not selected any nodes. Select nodes to delete first.");
            return;
        }

        new ConfirmDlg("Delete " + selNodesArray.length + " node(s) ?", "Confirm Delete",
            () => {
                let postDeleteSelNode: J.NodeInfo = this.getBestPostDeleteSelNode();

                S.util.ajax<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    "nodeIds": selNodesArray
                }, (res: J.DeleteNodesResponse) => {
                    this.deleteNodesResponse(res, { "postDeleteSelNode": postDeleteSelNode });
                });
            }
        ).open();
    }

    /* Gets the node we want to scroll to after a delete */
    getBestPostDeleteSelNode = (): J.NodeInfo => {
        /* Use a hashmap-type approach to saving all selected nodes into a lookup map */
        let nodesMap: Object = S.meta64.getSelectedNodesAsMapById();
        let bestNode: J.NodeInfo = null;
        let takeNextNode: boolean = false;

        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;

        /* now we scan the children, and the last child we encounterd up until we find the rist one in nodesMap will be the
        node we will want to select and scroll the user to AFTER the deleting is done */
        for (let i = 0; i < S.meta64.currentNodeData.node.children.length; i++) {
            let node: J.NodeInfo = S.meta64.currentNodeData.node.children[i];

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

    undoCutSelNodes = async (): Promise<void> => {
        this.nodesToMove = null; // reset
        this.nodesToMoveSet = {};

        /* now we render again and the nodes that were cut will disappear from view */
        await S.render.renderPageFromData();
    }

    cutSelNodes = (): void => {
        let selNodesArray = S.meta64.getSelectedNodeIdsArray();
        if (!selNodesArray || selNodesArray.length == 0) {
            S.util.showMessage("You have not selected any nodes. Select nodes first.");
            return;
        }

        new ConfirmDlg("Cut " + selNodesArray.length + " node(s), to paste/move to new location ?", "Confirm Cut",
            async () => {
                this.nodesToMove = selNodesArray;
                this.loadNodesToMoveSet(selNodesArray);
                S.meta64.selectedNodes = {}; // clear selections.

                /* now we render again and the nodes that were cut will disappear from view */
                await S.render.renderPageFromData();
            }
        ).open();
    }

    private loadNodesToMoveSet = (nodeIds: string[]) => {
        this.nodesToMoveSet = {};
        for (let id of nodeIds) {
            this.nodesToMoveSet[id] = true;
        }
    }

    //location=inside | inline
    pasteSelNodes = (location: string): void => {
        let highlightNode = S.meta64.getHighlightedNode();
        /*
         * For now, we will just cram the nodes onto the end of the children of the currently selected
         * page. Later on we can get more specific about allowing precise destination location for moved
         * nodes.
         */
        S.util.ajax<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            "targetNodeId": highlightNode.id,
            "nodeIds": this.nodesToMove,
            "location": location
        }, this.moveNodesResponse);
    }

    insertBookWarAndPeace = (): void => {
        new ConfirmDlg("Insert book War and Peace?<p/>Warning: You should have an EMPTY node selected now, to serve as the root node of the book!",
            "Confirm",
            () => {
                /* inserting under whatever node user has focused */
                let node = S.meta64.getHighlightedNode();

                if (!node) {
                    S.util.showMessage("No node is selected.");
                } else {
                    S.util.ajax<J.InsertBookRequest, J.InsertBookResponse>("insertBook", {
                        "nodeId": node.id,
                        "bookName": "War and Peace",
                        "truncated": S.user.isTestUserAccount()
                    }, this.insertBookResponse);
                }
            }
        ).open();
    }

    saveClipboardToNode = (): void => {
        (navigator as any).clipboard.readText().then(
            clipText => {
                S.util.ajax<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    "nodeId": "~notes",
                    "newNodeName": "",
                    "typeName": "u",
                    "createAtTop": true,
                    "content": clipText
                }, 
                    () => {
                        S.util.flashMessage("Clipboard content saved under your Notes node...\n\n"+clipText, true);
                    }
                );
            });
    }

    splitNode = (splitType: string, delimiter: string): void => {
        let highlightNode = S.meta64.getHighlightedNode();
        if (!highlightNode) {
            S.util.showMessage("You didn't select a node to split.");
            return;
        }

        S.util.ajax<J.SplitNodeRequest, J.SplitNodeResponse>("splitNode", {
            "splitType": splitType,
            "nodeId": highlightNode.id,
            "delimiter": delimiter
        }, this.splitNodeResponse);
    }

    splitNodeResponse = (res: J.SplitNodeResponse): void => {
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree(null, false);
            S.meta64.selectTab("mainTab");
            S.view.scrollToSelectedNode();
        }
    }
}
