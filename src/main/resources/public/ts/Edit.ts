import * as I from "./Interfaces";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { CreateNodeDlg } from "./dlg/CreateNodeDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { ImportFromFileDropzoneDlg } from "./dlg/ImportFromFileDropzoneDlg";
import { Constants as cnst } from "./Constants";
import { EditIntf } from "./intf/EditIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
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

    parentOfNewNode: I.NodeInfo = null;

    /* Instance of EditNodeDialog: For now creating new one each time */
    editNodeDlgInst: EditNodeDlg = null;

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
        let node: I.NodeInfo = S.meta64.getHighlightedNode();
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

    private insertBookResponse = (res: I.InsertBookResponse): void => {
        console.log("insertBookResponse running.");
        S.util.checkSuccess("Insert Book", res);

        S.view.refreshTree(null, false);
        S.meta64.selectTab("mainTab");
        S.view.scrollToSelectedNode();
    }

    private deleteNodesResponse = (res: I.DeleteNodesResponse, payload: Object): void => {
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

    private initNodeEditResponse = (res: I.InitNodeEditResponse): void => {
        if (S.util.checkSuccess("Editing node", res)) {
            let node: I.NodeInfo = res.nodeInfo;

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

                let dlg = new EditNodeDlg({node: editNode});

                //this tight-coupling is ugly. remove it (todo-0)
                this.editNodeDlgInst = dlg;
                dlg.open();
            } else {
                S.util.showMessage("You cannot edit nodes that you don't own.");
            }
        }
    }

    private moveNodesResponse = (res: I.MoveNodesResponse): void => {
        if (S.util.checkSuccess("Move nodes", res)) {
            this.nodesToMove = null; // reset
            this.nodesToMoveSet = {};
            S.view.refreshTree(null, false);
        }
    }

    private setNodePositionResponse = (res: I.SetNodePositionResponse): void => {
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

        return S.meta64.userPreferences.editMode && node.path != "/" &&
            (S.meta64.isAdminUser || S.meta64.userName == owner);
        // /*
        //  * Check that if we have a commentBy property we are the commenter, before allowing edit button also.
        //  */
        // (!props.isNonOwnedCommentNode(node) || props.isOwnedCommentNode(node)) //
        // && !props.isNonOwnedNode(node);
    }


    /* best we can do here is allow the disableInsert prop to be able to turn things off, node by node */
    isInsertAllowed = (node: any): boolean => {
        return !S.props.getNodePropertyVal(cnst.DISABLE_INSERT, node);
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

        S.meta64.treeDirty = true;
        if (S.edit.nodeInsertTarget) {
            S.util.ajax<I.InsertNodeRequest, I.InsertNodeResponse>("insertNode", {
                "parentId": S.edit.parentOfNewNode.id,
                "targetOrdinal": S.edit.nodeInsertTarget.ordinal,
                "newNodeName": "",
                "typeName": typeName ? typeName : "u"
            }, S.edit.insertNodeResponse);
        } else {
            S.util.ajax<I.CreateSubNodeRequest, I.CreateSubNodeResponse>("createSubNode", {
                "nodeId": S.edit.parentOfNewNode.id,
                "newNodeName": "",
                "typeName": typeName ? typeName : "u",
                "createAtTop": createAtTop
            }, S.edit.createSubNodeResponse);
        }
    }

    insertNodeResponse = (res: I.InsertNodeResponse): void => {
        if (S.util.checkSuccess("Insert node", res)) {
            S.meta64.initNode(res.newNode, true);
            S.meta64.highlightNode(res.newNode, true);
            this.runEditNode(res.newNode.uid);
        }
    }

    createSubNodeResponse = (res: I.CreateSubNodeResponse): void => {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.meta64.refresh();
            }
            else {
                S.meta64.initNode(res.newNode, true);
                this.runEditNode(res.newNode.uid);
            }
        }
    }

    saveNodeResponse = (res: I.SaveNodeResponse, payload: any): void => {
        if (S.util.checkSuccess("Save node", res)) {
            S.view.refreshTree(null, false, payload.savedId);
            S.meta64.selectTab("mainTab");
        }
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

    moveNodeUp = (uid?: string): void => {
        if (!uid) {
            let selNode: I.NodeInfo = S.meta64.getHighlightedNode();
            uid = selNode.uid;
        }

        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (node) {
            S.util.ajax<I.SetNodePositionRequest, I.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "up"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + uid);
        }
    }

    moveNodeDown = (uid?: string): void => {
        if (!uid) {
            let selNode: I.NodeInfo = S.meta64.getHighlightedNode();
            uid = selNode.uid;
        }

        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (node) {
            S.util.ajax<I.SetNodePositionRequest, I.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "down"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + uid);
        }
    }

    moveNodeToTop = (uid?: string): void => {
        if (!uid) {
            let selNode: I.NodeInfo = S.meta64.getHighlightedNode();
            uid = selNode.uid;
        }
        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (node) {
            S.util.ajax<I.SetNodePositionRequest, I.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "top"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + uid);
        }
    }

    moveNodeToBottom = (uid?: string): void => {
        if (!uid) {
            let selNode: I.NodeInfo = S.meta64.getHighlightedNode();
            uid = selNode.uid;
        }
        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (node) {
            S.util.ajax<I.SetNodePositionRequest, I.SetNodePositionResponse>("setNodePosition", {
                "nodeId": node.id,
                "targetName": "bottom"
            }, this.setNodePositionResponse);
        } else {
            console.log("idToNodeMap does not contain " + uid);
        }
    }

    /*
     * Returns the node above the specified node or null if node is itself the top node
     */
    getNodeAbove = (node: I.NodeInfo): any => {
        if (!S.meta64.currentNodeData) return null;
        let ordinal: number = S.meta64.getOrdinalOfNode(node);
        if (ordinal <= 0)
            return null;
        return S.meta64.currentNodeData.node.children[ordinal - 1];
    }

    /*
     * Returns the node below the specified node or null if node is itself the bottom node
     */
    getNodeBelow = (node: I.NodeInfo): I.NodeInfo => {
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

    runEditNode = (uid: any): void => {
        let node: I.NodeInfo = null;
        if (!uid) {
            node = S.meta64.getHighlightedNode();
        }
        else {
            node = S.meta64.uidToNodeMap[uid];
        }

        if (!node) {
            S.util.showMessage("Unknown nodeId in editNodeClick: " + uid);
            return;
        }

        S.util.ajax<I.InitNodeEditRequest, I.InitNodeEditResponse>("initNodeEdit", {
            "nodeId": node.id
        }, this.initNodeEditResponse);
    }

    insertNode = (uid?: any, typeName?: string): void => {
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
        let node: I.NodeInfo = null;
        if (!uid) {
            node = S.meta64.getHighlightedNode();
        } else {
            node = S.meta64.uidToNodeMap[uid];
        }

        if (node) {
            this.nodeInsertTarget = node;
            this.startEditingNewNode(typeName);
        }
    }

    createSubNode = (uid?: any, typeName?: string, createAtTop?: boolean): void => {
        /*
         * If no uid provided we deafult to creating a node under the currently viewed node (parent of current page), or any selected
         * node if there is a selected node.
         */
        if (!uid) {
            let highlightNode: I.NodeInfo = S.meta64.getHighlightedNode();
            if (highlightNode) {
                this.parentOfNewNode = highlightNode;
            }
            else {
                if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;
                this.parentOfNewNode = S.meta64.currentNodeData.node;
            }
        } else {
            this.parentOfNewNode = S.meta64.uidToNodeMap[uid];
            if (!this.parentOfNewNode) {
                console.log("Unknown nodeId in createSubNode: " + uid);
                return;
            }
        }

        /*
         * this indicates we are NOT inserting inline. An inline insert would always have a target.
         */
        this.nodeInsertTarget = null;
        this.startEditingNewNode(typeName, createAtTop);
    }

    replyToComment = (uid: any): void => {
        this.createSubNode(uid);
    }

    selectAllNodes = async (): Promise<void> => {
        let highlightNode = S.meta64.getHighlightedNode();
        S.util.ajax<I.SelectAllNodesRequest, I.SelectAllNodesResponse>("selectAllNodes", {
            "parentNodeId": highlightNode.id
        }, async (res: I.SelectAllNodesResponse) => {
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
                let postDeleteSelNode: I.NodeInfo = this.getBestPostDeleteSelNode();

                S.util.ajax<I.DeleteNodesRequest, I.DeleteNodesResponse>("deleteNodes", {
                    "nodeIds": selNodesArray
                }, (res: I.DeleteNodesResponse) => {
                    this.deleteNodesResponse(res, { "postDeleteSelNode": postDeleteSelNode });
                });
            }
        ).open();
    }

    /* Gets the node we want to scroll to after a delete */
    getBestPostDeleteSelNode = (): I.NodeInfo => {
        /* Use a hashmap-type approach to saving all selected nodes into a lookup map */
        let nodesMap: Object = S.meta64.getSelectedNodesAsMapById();
        let bestNode: I.NodeInfo = null;
        let takeNextNode: boolean = false;

        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node.children) return null;

        /* now we scan the children, and the last child we encounterd up until we find the rist one in nodesMap will be the
        node we will want to select and scroll the user to AFTER the deleting is done */
        for (let i = 0; i < S.meta64.currentNodeData.node.children.length; i++) {
            let node: I.NodeInfo = S.meta64.currentNodeData.node.children[i];

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
        S.util.ajax<I.MoveNodesRequest, I.MoveNodesResponse>("moveNodes", {
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
                    S.util.ajax<I.InsertBookRequest, I.InsertBookResponse>("insertBook", {
                        "nodeId": node.id,
                        "bookName": "War and Peace",
                        "truncated": S.user.isTestUserAccount()
                    }, this.insertBookResponse);
                }
            }
        ).open();
    }

    splitNode = (splitType: string): void => {
        let highlightNode = S.meta64.getHighlightedNode();
        if (!highlightNode) {
            S.util.showMessage("You didn't select a node to split.");
            return;
        }

        S.util.ajax<I.SplitNodeRequest, I.SplitNodeResponse>("splitNode", {
            "splitType": splitType,
            "nodeId": highlightNode.id,
            "delimiter": null
        }, this.splitNodeResponse);
    }

    splitNodeResponse = (res: I.SplitNodeResponse): void => {
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree(null, false);
            S.meta64.selectTab("mainTab");
            S.view.scrollToSelectedNode();
        }
    }
}
