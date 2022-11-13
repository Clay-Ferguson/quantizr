import { EventInput } from "@fullcalendar/react";
import { dispatch, getAppState, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { TabPanel } from "./comp/TabPanel";
import { Constants as C } from "./Constants";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { SharingDlg } from "./dlg/SharingDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { FullScreenType } from "./Interfaces";
import { TabIntf } from "./intf/TabIntf";
import * as J from "./JavaIntf";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { S } from "./Singletons";
import { FeedTab } from "./tabs/data/FeedTab";
import { MainTab } from "./tabs/data/MainTab";

declare const g_requireCrypto: string;

export class Edit {
    showReadOnlyProperties: boolean = false;

    openImportDlg = (state: AppState): any => {
        const node = S.nodeUtil.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg = new UploadFromFileDropzoneDlg(node.id, "", false, null, true, true, () => {
            S.view.jumpToId(node.id);
        });
        dlg.open();
    }

    openExportDlg = (state: AppState): any => {
        const node = S.nodeUtil.getHighlightedNode(state);
        if (node) {
            new ExportDlg(node).open();
        }
    }

    private insertBookResponse = (res: J.InsertBookResponse, state: AppState): any => {
        S.util.checkSuccess("Insert Book", res);

        S.view.refreshTree({
            nodeId: null,
            zeroOffset: true,
            renderParentIfLeaf: false,
            highlightId: null,
            forceIPFSRefresh: false,
            scrollToTop: true,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            state
        });
        S.view.scrollToNode(state);
    }

    private joinNodesResponse = (res: J.JoinNodesResponse, state: AppState): any => {
        state = getAppState(state);
        if (S.util.checkSuccess("Join node", res)) {
            S.nodeUtil.clearSelNodes(state);
            S.view.refreshTree({
                nodeId: state.node.id,
                zeroOffset: false,
                renderParentIfLeaf: false,
                highlightId: null,
                forceIPFSRefresh: false,
                scrollToTop: false,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                state
            });
        }
    }

    public initNodeEditResponse = async (res: J.InitNodeEditResponse, forceUsePopup: boolean, encrypt: boolean, showJumpButton: boolean, replyToId: string, afterEditAction: Function, state: AppState) => {
        if (S.util.checkSuccess("Editing node", res)) {
            if (state.mobileMode) forceUsePopup = true;

            /* NOTE: Removing 'editMode' check here is new 4/14/21, and without was stopping editing from calendar view which we
            do need even when edit mode is technically off */
            const editingAllowed = /* state.userPrefs.editMode && */ this.isEditAllowed(res.nodeInfo, state);
            if (editingAllowed) {

                // these conditions determine if we want to run editing in popup, instead of inline in the page.
                let editInPopup = forceUsePopup || state.mobileMode ||
                    // node not found on tree.
                    (!S.nodeUtil.displayingOnTree(state, res.nodeInfo.id) &&
                        !S.nodeUtil.displayingOnTree(state, S.quanta.newNodeTargetId)) ||
                    // not currently viewing tree
                    S.quanta.activeTab !== C.TAB_MAIN ||
                    S.util.fullscreenViewerActive(state);

                if (S.quanta.activeTab === C.TAB_DOCUMENT || //
                    S.quanta.activeTab === C.TAB_SEARCH || //
                    S.quanta.activeTab === C.TAB_TIMELINE) {
                    editInPopup = true;
                }

                /* If we're editing on the feed tab, we set the 'state.editNode' which makes the gui know to render
                the editor at that place rather than opening a popup now */
                if (!editInPopup && S.quanta.activeTab === C.TAB_FEED) {
                    dispatch("StartEditingInFeed", s => {
                        s.editNodeReplyToId = replyToId;
                        s.editNodeOnTab = s.mobileMode ? null : S.quanta.activeTab;
                        s.editNode = res.nodeInfo;
                        s.editShowJumpButton = showJumpButton;
                        s.editEncrypt = encrypt;
                        return s;
                    });
                }
                /* Either run the node editor as a popup or embedded, depending on whether we have a fullscreen
                calendar up and wether we're on the main tab, etc */
                else if (editInPopup) {
                    await promiseDispatch("startEditing", s => {
                        s.editNode = res.nodeInfo;
                        return s;
                    });
                    const dlg = new EditNodeDlg(encrypt, showJumpButton, null, afterEditAction);
                    dlg.open();
                } else {
                    dispatch("startEditing", s => {
                        s.editNode = res.nodeInfo;
                        s.editNodeOnTab = s.mobileMode ? null : S.quanta.activeTab;
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
    private moveNodesResponse = (res: J.MoveNodesResponse, nodeId: string, pasting: boolean, state: AppState) => {
        if (S.util.checkSuccess("Move nodes", res)) {
            if (res.signaturesRemoved) {
                setTimeout(() => {
                    S.util.showMessage("Signatures on these nodes were removed, because signature is dependent upon path location.", "Signatures");
                }, 1000);
            }
            dispatch("SetNodesToMove", s => {
                s.nodesToMove = null;
                return s;
            });

            // if pasting do a kind of refresh which will maintain us at the same page parent.
            if (pasting) {
                S.view.refreshTree({
                    nodeId: null,
                    zeroOffset: false,
                    renderParentIfLeaf: false,
                    highlightId: nodeId,
                    forceIPFSRefresh: false,
                    scrollToTop: false,
                    allowScroll: true,
                    setTab: true,
                    forceRenderParent: false,
                    state
                });
            }
            else {
                S.view.jumpToId(nodeId);
            }
        }
    }

    private setNodePositionResponse = (res: J.SetNodePositionResponse, id: string, state: AppState) => {
        if (S.util.checkSuccess("Change node position", res)) {
            S.view.jumpToId(id, true);
        }
    }

    /* returns true if we are admin or else the owner of the node */
    isEditAllowed = (node: any, state: AppState): boolean => {
        if (!node) return false;
        if (state.isAdminUser) return true;

        // if no owner treat as if admin owns
        return state.userName === (node.owner || "admin");
    }

    /*
    * nodeInsertTarget holds the node that was clicked on at the time the insert was requested, and
    * is sent to server for ordinal position assignment of new node. Also if this var is null, it indicates we are
    * creating in a 'create under parent' mode, versus non-null meaning 'insert inline' type of insert.
    */
    startEditingNewNode = async (typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, nodeInsertTarget: J.NodeInfo, ordinalOffset: number, state: AppState) => {
        if (!S.props.isWritableByMe(parentNode)) {
            // console.log("Rejecting request to edit. Not authorized");
            return;
        }

        if (S.util.ctrlKeyCheck()) {
            let blob = null;
            const clipboardText = await (navigator as any)?.clipboard?.readText();
            if (!clipboardText) {
                blob = await S.util.readClipboardFile();
                if (blob) {
                    EditNodeDlg.pendingUploadFile = blob;
                }
            }

            if (nodeInsertTarget) {
                const res = await S.rpcUtil.rpc<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                    pendingEdit: false,
                    parentId: parentNode.id,
                    targetOrdinal: nodeInsertTarget.ordinal + ordinalOffset,
                    newNodeName: "",
                    typeName: typeName || J.NodeType.NONE,
                    initialValue: clipboardText
                });
                if (blob) {
                    this.insertNodeResponse(res, state);
                }
            } else {
                const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    pendingEdit: false,
                    nodeId: parentNode.id,
                    newNodeName: "",
                    typeName: typeName || J.NodeType.NONE,
                    createAtTop,
                    content: clipboardText,
                    typeLock: false,
                    properties: null,
                    shareToUserId: null,
                    boostTarget: null,
                    fediSend: false
                });
                if (blob) {
                    this.createSubNodeResponse(res, false, null, null, state);
                }
            }

            if (!blob) {
                S.quanta.refresh(state);
            }
        }
        else {
            if (nodeInsertTarget) {
                const res = await S.rpcUtil.rpc<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                    pendingEdit: true,
                    parentId: parentNode.id,
                    targetOrdinal: nodeInsertTarget.ordinal + ordinalOffset,
                    newNodeName: "",
                    typeName: typeName || J.NodeType.NONE,
                    initialValue: ""
                });
                this.insertNodeResponse(res, state);
            } else {
                const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    pendingEdit: true,
                    nodeId: parentNode.id,
                    newNodeName: "",
                    typeName: typeName || J.NodeType.NONE,
                    createAtTop,
                    content: null,
                    typeLock: false,
                    properties: null,
                    shareToUserId: null,
                    boostTarget: null,
                    fediSend: false
                });
                this.createSubNodeResponse(res, false, null, null, state);
            }
        }
    }

    insertNodeResponse = (res: J.InsertNodeResponse, state: AppState) => {
        if (S.util.checkSuccess("Insert node", res)) {
            S.nodeUtil.highlightNode(res.newNode, false, state);
            this.runEditNode(null, null, res.newNode.id, false, false, false, null, null, state);
        }
    }

    createSubNodeResponse = (res: J.CreateSubNodeResponse, forceUsePopup: boolean, replyToId: string, afterEditAction: Function, state: AppState) => {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.quanta.refresh(state);
            }
            else {
                this.runEditNode(null, null, res.newNode.id, forceUsePopup, res.encrypt, false, replyToId, afterEditAction, state);
            }
        }
    }

    saveNodeResponse = async (node: J.NodeInfo, res: J.SaveNodeResponse, allowScroll: boolean,
        newNodeTargetId: string, newNodeTargetOffset: number, state: AppState) => {
        if (S.util.checkSuccess("Save node", res)) {

            await this.distributeKeys(node, res.aclEntries);

            // if on feed tab, and it became dirty while we were editing then refresh it.
            // todo-2: shouldn't we do this regardless of which tab is active?
            if (state.activeTab === C.TAB_FEED) {
                if (FeedTab.inst?.props?.feedDirtyList) {
                    for (const node of FeedTab.inst.props.feedDirtyList) {
                        // console.log("Force Feed: " + node.content);
                        S.push.forceFeedItem(node, state);
                    }
                    FeedTab.inst.props.feedDirtyList = null;

                    // all the data in feedData will have been updated by forceFeedItem so force react to render now.
                    dispatch("ForceFeedResults", s => {
                        return s;
                    });
                }
            }

            // find and update the history item if it exists.
            const histItem = S.quanta.nodeHistory.find(function (h: NodeHistoryItem) {
                return h.id === node.id;
            });

            if (histItem) {
                histItem.content = S.nodeUtil.getShortContent(node);
            }

            // It's possible to end up editing a node that's not even on the page, or a child of a node on the page,
            // and so before refreshing the screen we check for that edge case.
            // console.log("saveNodeResponse: " + S.util.prettyPrint(node));
            const parentPath = S.props.getParentPath(node);
            if (!parentPath) return;

            const newNode = await this.refreshNodeFromServer(node.id, newNodeTargetId);

            if (state.activeTab === C.TAB_MAIN) {
                // Inject the new node right into the page children
                if (newNodeTargetId) {
                    await this.injectNewNodeIntoChildren(newNode, newNodeTargetId, newNodeTargetOffset);
                }
                // any kind of insert that's not a new node injected into the page ends up here.
                else {
                    if (!S.nodeUtil.displayingOnTree(state, node.id)) {
                        S.view.jumpToId(node.id);
                    }
                }
            }

            if (state.fullScreenConfig.type === FullScreenType.CALENDAR) {
                S.render.showCalendar(state.fullScreenConfig.nodeId, state);
            }
        }
    }

    injectNewNodeIntoChildren = (newNode: J.NodeInfo, newNodeTargetId: string, newNodeTargetOffset: number): Promise<AppState> => {
        // we return the promise from the dispatch and to not wait for it here.
        return promiseDispatch("InjectNewNodeIntoChildren", s => {
            if (s.node.children) {
                const newChildren: J.NodeInfo[] = [];

                // we'll be renumbering ordinals so use this to keep track, by starting at whatever
                // the first child was at before the insert
                let ord = s.node.children[0].logicalOrdinal;

                // build newChildren by inserting the 'newNode' into it's proper place into the children array.
                s.node.children.forEach(child => {
                    // offset==0 means insert above.
                    if (newNodeTargetId === child.id && newNodeTargetOffset === 0) {
                        newNode.logicalOrdinal = ord++;
                        newChildren.push(newNode);
                    }
                    child.logicalOrdinal = ord++;
                    newChildren.push(child);

                    // offset==0 means insert below.
                    if (newNodeTargetId === child.id && newNodeTargetOffset === 1) {

                        // if node was the lastChild, we have a new last child.
                        if (child.lastChild) {
                            child.lastChild = false;
                            newNode.lastChild = true;
                        }

                        newNode.logicalOrdinal = ord++;
                        newChildren.push(newNode);
                    }
                });
                s.node.children = newChildren;
            }
            else {
                s.node.children = [newNode];
            }
            return s;
        });
    }

    refreshNodeFromServer = async (nodeId: string, newNodeTargetId: string): Promise<J.NodeInfo> => {
        return new Promise<J.NodeInfo>(async (resolve, reject) => {
            const state = getAppState();

            const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                forceRenderParent: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: true,
                parentCount: state.userPrefs.showParents ? 1 : 0
            });

            if (!res || !res.node) {
                resolve(null);
                return;
            }

            resolve(res.node);

            // we only need to update/dispatch here if we're NOT doing an 'insert into page' type insert
            if (!newNodeTargetId) {
                await promiseDispatch("RefreshNodeFromServer", s => {
                    // if the node is our page parent (page root)
                    if (res.node.id === s.node?.id) {
                        // preserve the children, when updating the root node, because they will not have been obtained
                        // due to the 'singleNode=true' in the request
                        res.node.children = s.node.children;
                        s.node = res.node;
                    }

                    // make all tabs update their copy of the node of they have it
                    state.tabData.forEach((td: TabIntf) => {
                        td.replaceNode(s, res.node);
                    });

                    return s;
                });
            }
        });
    }

    distributeKeys = async (node: J.NodeInfo, aclEntries: J.AccessControlInfo[]) => {
        if (!aclEntries || !S.props.isEncrypted(node)) {
            return;
        }

        for (const ac of aclEntries) {
            await this.addCipherKeyToNode(node, ac.publicKey, ac.principalNodeId);
        }
    }

    setRssHeadlinesOnly = async (state: AppState, val: boolean) => {
        state.userPrefs.rssHeadlinesOnly = val;
        S.util.saveUserPreferences(state);
    }

    setMainPanelCols = (val: number) => {
        setTimeout(() => {
            const state = getAppState();
            if (val < 4) val = 4;
            if (val > 8) val = 8;
            state.userPrefs.mainPanelCols = val;
            S.util.saveUserPreferences(state);
        }, 100);
    };

    setMetadataOption = (val: boolean) => {
        setTimeout(() => {
            const state = getAppState();
            state.userPrefs.showMetaData = val;
            S.util.saveUserPreferences(state);
        }, 100);
    };

    // saveTabsTopmostVisibie and scrollTabsTopmostVisible should always be called as a pair
    saveTabsTopmostVisible = async (state: AppState): Promise<boolean> => {
        let doScrolling = false;

        // in this loop record the currently topmost visible element in each tab, so we can scroll
        // those back it view after doing some change to the DOM that will potentially cause the page
        // to jump to a different effective scroll position.
        for (const data of state.tabData) {
            // Warning: Uninitialized tabs will have 'scrollPos==undefined' here, so we check for that case, because
            // otherwise it will get interpreted as a number
            // We do nothing if user hasn't scrolled down enough to loose their place when the screen rerenders.
            if (data.scrollPos == null || data.scrollPos === undefined || data.scrollPos < window.innerHeight / 2) {
                // do nothing, if window isn't scrolled hafway at least
            }
            else {
                doScrolling = true;
                // NOTE: This is tricky here, but correct. The first 'id' is an ID, and the second one is a "class" (passed as arguments
                // into findFirstVisibleElm), and this is not a bug. It's just a coincidence that 'data.id' is the correct thing
                // to use for both parameters per what's in the DOM.
                const elm = S.util.findFirstVisibleElm(data.id, data.id);
                data.topmostVisibleElmId = elm?.id;
            }
        }

        if (doScrolling) {
            await TabPanel.inst.setVisibility(false);
        }
        return doScrolling;
    }

    // saveTabsTopmostVisibie and scrollTabsTopmostVisible should always be called as a pair
    scrollTabsTopmostVisible = (state: AppState) => {
        // this timer is because all scrolling in browser needs to be delayed or we can have failures.
        setTimeout(async () => {
            // scroll into view whatever was the topmost item
            for (const data of state.tabData) {
                if (data.topmostVisibleElmId) {
                    // we have to lookup the element again, because our DOM will have rendered and we will likely
                    // have a new actual element.
                    const elm = document.getElementById(data.topmostVisibleElmId);
                    if (elm) {
                        elm.scrollIntoView(true);
                    }
                }
            }
            setTimeout(async () => {
                await TabPanel.inst.setVisibility(true);
            }, 250);
        }, 250);
    }

    // WARNING: This func is expected to NOT alter that the active tab is!
    runScrollAffectingOp = async (state: AppState, func: Function) => {
        const doScrolling = await this.saveTabsTopmostVisible(state);
        if (doScrolling) {
            // turn off Comp stuff so it doesn't interfere with what we're about to do with scrolling.
            Comp.allowScrollSets = false;
        }
        await func();

        if (doScrolling) {
            this.scrollTabsTopmostVisible(state);
            Comp.allowScrollSets = true;
        }
    }

    // We allow a function (func) to run here in such a way that the scroll positions of every tab panel are very
    // intelligently maintained so the user doesn't loose their place after the screen completely updates.
    setUserPreferenceVal = (state: AppState, func: (s: AppState) => void) => {
        this.runScrollAffectingOp(state, async () => {
            // we force this to go thru immediately, but the saveUserPerference is call is async and we don't wait.
            await promiseDispatch("modUserPref", (s) => {
                func(s);
                S.util.saveUserPreferences(s);
                return s;
            });
        });
    }

    toggleEditMode = async (state: AppState) => {
        this.setUserPreferenceVal(state, (s: AppState) => { s.userPrefs.editMode = !s.userPrefs.editMode; });
    }

    toggleShowMetaData = (state: AppState) => {
        this.setUserPreferenceVal(state, (s: AppState) => { s.userPrefs.showMetaData = !s.userPrefs.showMetaData; });
    }

    toggleNsfw = async (state: AppState) => {
        state.userPrefs.nsfw = !state.userPrefs.nsfw;
        return S.util.saveUserPreferences(state, true);
    }

    toggleShowProps = async (state: AppState) => {
        state.userPrefs.showProps = !state.userPrefs.showProps;
        return S.util.saveUserPreferences(state, true);
    }

    toggleShowParents = (state: AppState) => {
        state.userPrefs.showParents = !state.userPrefs.showParents;
        S.util.saveUserPreferences(state, false);
        S.quanta.refresh(state);
    }

    // This updates userPref without affecting the GUI (no rerendering)
    setShowComments = async (showReplies: boolean, state: AppState) => {

        // update render state
        dispatch("setShowReplies", (s) => {
            s.userPrefs.showReplies = showReplies;
            return s;
        });

        // update our db
        state.userPrefs.showReplies = showReplies;
        S.util.saveUserPreferences(state, false);
    }

    toggleShowReplies = async (state: AppState) => {
        state.userPrefs.showReplies = !state.userPrefs.showReplies;
        await S.util.saveUserPreferences(state, false);

        // todo-1: we need a PubSub broadcast event for "SHOW_REPLIES_CHANGED" that we can send out to all tabs.
        if (state.activeTab === C.TAB_MAIN) {
            S.quanta.refresh(state);
        }
        else if (state.activeTab === C.TAB_DOCUMENT) {
            const data: TabIntf = S.tabUtil.getAppTabData(state, C.TAB_DOCUMENT);
            if (data) {
                S.srch.showDocument(data.props.node, false, getAppState());
            }
        }
        else {
            // update render state (using local state), this way if we're not refreshing the tree.
            dispatch("setShowReplies", (s) => {
                s.userPrefs.showReplies = state.userPrefs.showReplies;
                return s;
            });
        }
    }

    moveNodeUp = async (evt: Event, id: string, state?: AppState) => {
        id = S.util.allowIdFromEvent(evt, id);
        state = getAppState(state);
        if (!id) {
            const selNode = S.nodeUtil.getHighlightedNode(state);
            id = selNode?.id;
        }

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "up"
            });
            this.setNodePositionResponse(res, id, state);
        }
    }

    moveNodeDown = async (evt: Event, id: string, state: AppState) => {
        id = S.util.allowIdFromEvent(evt, id);
        state = getAppState(state);
        if (!id) {
            const selNode = S.nodeUtil.getHighlightedNode(state);
            id = selNode?.id;
        }

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "down"
            });
            this.setNodePositionResponse(res, id, state);
        }
    }

    moveNodeToTop = async (id: string = null, state: AppState = null) => {
        state = getAppState(state);
        if (!id) {
            const selNode = S.nodeUtil.getHighlightedNode(state);
            id = selNode?.id;
        }

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "top"
            });
            this.setNodePositionResponse(res, id, state);
        }
    }

    moveNodeToBottom = async (id: string = null, state: AppState = null) => {
        state = getAppState(state);
        if (!id) {
            const selNode = S.nodeUtil.getHighlightedNode(state);
            id = selNode?.id;
        }

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "bottom"
            });
            this.setNodePositionResponse(res, id, state);
        }
    }

    getFirstChildNode = (state: AppState): any => {
        if (!state.node || !state.node.children || state.node.children.length === 0) return null;
        return state.node.children[0];
    }

    getLastChildNode = (state: AppState): J.NodeInfo => {
        if (!state.node || !state.node.children || state.node.children.length === 0) return null;
        return state.node.children[state.node.children.length - 1];
    }

    checkEditPending = (): boolean => {
        const state = getAppState(null);

        // state.editNode holds non-null always whenever there is editing underway.
        if (state.editNode) {
            S.util.showMessage("You're already editing a node. Finish that edit first. Tip: Use `Menu -> Edit -> Continue Editing` if you forgot which node you're editing.", "Warning");
            return true;
        }
        return false;
    }

    runEditNodeByClick = (evt: Event, id: string) => {
        if (this.checkEditPending()) return;

        id = S.util.allowIdFromEvent(evt, id);

        // we set noScrollToId just to block the future attempt (one time) to
        // scroll to this, because this is a hint telling us we are ALREADY
        // scrolled to this ID so any scrolling will be unnecessary
        S.quanta.noScrollToId = id;
        this.runEditNode(null, null, id, false, false, false, null, null);

        // it's safest and best to just disable scrolling for a couple of seconds during which editing is being initiated.
        setTimeout(() => {
            S.quanta.noScrollToId = null;
        }, 2000);
    }

    /* This can run as an actuall click event function in which only 'evt' is non-null here */
    runEditNode = async (evt: Event, overrideContent: string, id: string, forceUsePopup: boolean, encrypt: boolean, showJumpButton: boolean, replyToId: string, afterEditAction: Function, state?: AppState) => {
        if (g_requireCrypto === "true" && !S.crypto.avail) {
            S.util.showMessage("Crypto support not available", "Warning");
            return;
        }

        id = S.util.allowIdFromEvent(evt, id);
        state = getAppState(state);
        if (!id) {
            const node = S.nodeUtil.getHighlightedNode(state);
            if (node) {
                id = node.id;
            }
        }

        if (!id) {
            S.util.showMessage("Unknown nodeId in editNodeClick: ", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            nodeId: id
        });

        if (res.nodeInfo && overrideContent) {
            res.nodeInfo.content = overrideContent;
        }

        this.initNodeEditResponse(res, forceUsePopup, encrypt, showJumpButton, replyToId, afterEditAction, state);
    }

    insertNode = (id: string, typeName: string, ordinalOffset: number, state?: AppState) => {
        if (this.checkEditPending()) return;

        state = getAppState(state);
        if (!state.node || !state.node.children) return;

        /*
         * We get the node selected for the insert position by using the uid if one was passed in or using the
         * currently highlighted node if no uid was passed.
         */
        let node: J.NodeInfo = null;
        if (!id) {
            node = S.nodeUtil.getHighlightedNode(state);
        } else {
            node = MainTab.inst?.findNode(state, id);
        }

        if (node) {
            S.quanta.newNodeTargetId = id;
            S.quanta.newNodeTargetOffset = ordinalOffset;
            this.startEditingNewNode(typeName, false, state.node, node, ordinalOffset, state);
        }
    }

    newSubNode = async (evt: Event, id: string) => {
        if (this.checkEditPending()) return;

        id = S.util.allowIdFromEvent(evt, id);
        const state = getAppState();
        if (S.util.ctrlKeyCheck()) {
            this.saveClipboardToChildNode(id);
        }
        else {
            this.createSubNode(id, null, true, state.node, null);
        }
    }

    createSubNode = (id: any, typeName: string, createAtTop: boolean, parentNode: J.NodeInfo, state: AppState): any => {
        state = getAppState(state);
        /*
         * If no uid provided we deafult to creating a node under the currently viewed node (parent of current page), or any selected
         * node if there is a selected node.
         */
        if (!id) {
            const node = S.nodeUtil.getHighlightedNode(state);
            if (node) {
                parentNode = node;
            }
            else {
                if (!state.node || !state.node.children) return null;
                parentNode = state.node;
            }
        } else {
            parentNode = MainTab.inst?.findNode(state, id);
            if (!parentNode) {
                // console.log("Unknown nodeId in createSubNode: " + id);
                return;
            }
        }

        this.startEditingNewNode(typeName, createAtTop, parentNode, null, 0, state);
    }

    selectAllNodes = async (state: AppState) => {
        const highlightNode = S.nodeUtil.getHighlightedNode(state);
        const res = await S.rpcUtil.rpc<J.SelectAllNodesRequest, J.SelectAllNodesResponse>("selectAllNodes", {
            parentNodeId: highlightNode.id
        });
        S.nodeUtil.selectAllNodes(res.nodeIds);
    }

    clearInbox = async (state: AppState) => {
        S.nodeUtil.clearSelNodes(state);

        const dlg = new ConfirmDlg("Permanently delete the nodes in your Inbox", "Clear Inbox",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (dlg.yes) {
            await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: ["~" + J.NodeType.INBOX],
                childrenOnly: true,
                bulkDelete: false
            });
            S.nav.openContentNode(state.userProfile.userNodeId, state);
        }
    }

    subGraphHash = async () => {
        const appState = getAppState();
        const node = S.nodeUtil.getHighlightedNode(appState);

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        S.rpcUtil.rpc<J.SubGraphHashRequest, J.SubGraphHashResponse>("subGraphHash", {
            nodeId: node.id,
            recursive: true
        }).then((res: J.SubGraphHashResponse) => {
            if (res.success) {
                S.util.showMessage(res.message);
            }
            else {
                S.util.showMessage("operation failed.");
            }
        });

        S.util.showMessage("Request sumitted. Check the node for property " + J.NodeProp.SUBGRAPH_HASH);
    }

    joinNodes = async (state?: AppState) => {
        state = getAppState(state);

        const selNodesArray = S.nodeUtil.getSelNodeIdsArray(state);
        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("Select some nodes to join.", "Warning");
            return;
        }

        const confirmMsg = "Join " + selNodesArray.length + " node(s) ?";
        const dlg = new ConfirmDlg(confirmMsg, "Confirm Join " + selNodesArray.length,
            "btn-danger", "alert alert-info");
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.JoinNodesRequest, J.JoinNodesResponse>("joinNodes", {
                nodeIds: selNodesArray
            });
            this.joinNodesResponse(res, state);
        }
    }

    /*
    * Deletes all nodes owned by you but NOT rooted in your own account root.
    */
    bulkDelete = async () => {
        const confirmMsg = "Bulk Delete all your nodes *not* rooted in your account?";
        const dlg = new ConfirmDlg(confirmMsg, "Confirm Delete",
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: null,
                childrenOnly: false,
                bulkDelete: true
            });
            S.util.showMessage(res.message, "Message");
        }
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever the user
     * has currenly selected (via checkboxes)
     */
    deleteSelNodes = async (evt: Event = null, id: string = null) => {
        id = S.util.allowIdFromEvent(evt, id);

        // if a nodeId was specified we use it as the selected nodes to delete
        if (id) {
            await promiseDispatch("SelectNode", s => {
                S.nav.setNodeSel(true, id, s);
                return s;
            });
        }

        const state = getAppState();
        // note: the setNodeSel above isn't causing this to get anything here
        const selNodesArray = S.nodeUtil.getSelNodeIdsArray(state);

        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("Select some nodes to delete.", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.userProfile?.userNodeId)) {
            S.util.showMessage("You can't delete your account root node!", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === state.node?.id)) {
            S.util.showMessage("You can't delete your page node! Go up a level to do that.", "Warning");
            return;
        }

        const confirmMsg = "Delete " + selNodesArray.length + " node(s) ?";
        const dlg = new ConfirmDlg(confirmMsg, "Confirm Delete " + selNodesArray.length,
            "btn-danger", "alert alert-danger");
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: selNodesArray,
                childrenOnly: false,
                bulkDelete: false
            });
            this.removeNodesFromHistory(selNodesArray, state);
            this.removeNodesFromCalendarData(selNodesArray, state);

            /* Node: state.node can be null if we've never been to the tree view yet */
            if (state.node && S.util.checkSuccess("Delete node", res)) {
                if (state.node.children) {
                    state.node.children = state.node.children.filter(child => !selNodesArray.find(id => id === child?.id));
                }

                if (state.activeTab === C.TAB_MAIN && state.node.children.length === 0) {
                    dispatch("NodeDeleteComplete", s => {
                        // remove this node from all data from all the tabs, so they all refresh without
                        // the deleted node without being queries from the server again.
                        selNodesArray.forEach(id => {
                            S.srch.removeNodeById(id, s);
                        });
                        s.selectedNodes.clear();
                        return s;
                    });
                    S.view.jumpToId(state.node.id);
                }
                else {
                    dispatch("UpdateChildren", s => {
                        selNodesArray.forEach(id => {
                            S.srch.removeNodeById(id, s);
                        });
                        s.selectedNodes.clear();
                        s.node.children = state.node.children;
                        return s;
                    });
                }
            }

            /* We waste a tiny bit of CPU/bandwidth here by just always updating the bookmarks in case
             we just deleted some. This could be slightly improved to KNOW if we deleted any bookmarks, but
            the added complexity to achieve that for recursive tree deletes doesn't pay off */
            setTimeout(() => {
                S.util.loadBookmarks();
            }, 500);
        }
    }

    /* Updates 'nodeHistory' when nodes are deleted */
    removeNodesFromHistory = (selNodesArray: string[], appState: AppState) => {
        if (!selNodesArray) return;
        selNodesArray.forEach((id: string) => {
            // remove any top level history item that matches 'id'
            S.quanta.nodeHistory = S.quanta.nodeHistory.filter(function (h: NodeHistoryItem) {
                return h.id !== id;
            });

            // scan all top level history items, and remove 'id' from any subItems
            S.quanta.nodeHistory.forEach(function (h: NodeHistoryItem) {
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
        // dispatch("UpdateCalendarData", s => {
        //     return appState;
        // });
    }

    undoCutSelNodes = () => {
        dispatch("SetNodesToMove", s => {
            s.nodesToMove = null;
            return s;
        });
    }

    cutSelNodes = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, null);

        dispatch("SetNodesToMove", s => {
            S.nav.setNodeSel(true, id, s);
            s.nodesToMove = S.nodeUtil.getSelNodeIdsArray(s);
            s.selectedNodes.clear();
            return s;
        });
    }

    pasteSelNodesInside = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const state = getAppState();
        this.pasteSelNodes(id, "inside", state);
    }

    // location=inside | inline | inline-above (todo-2: put in java-aware enum)
    pasteSelNodes = async (nodeId: string, location: string, state?: AppState) => {
        state = getAppState(state);
        /*
         * For now, we will just cram the nodes onto the end of the children of the currently selected
         * page (for the 'inside' option). Later on we can get more specific about allowing precise destination location for moved
         * nodes.
         */
        const res = await S.rpcUtil.rpc<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId: nodeId,
            nodeIds: state.nodesToMove,
            location
        });
        this.moveNodesResponse(res, nodeId, true, state);
    }

    pasteSelNodes_InlineAbove = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline-above");
    }

    pasteSelNodes_Inline = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline");
    }

    insertBookWarAndPeace = async (state: AppState) => {
        const dlg = new ConfirmDlg("Warning: You should have an EMPTY node selected now, to serve as the root node of the book!",
            "Confirm", null, null);
        await dlg.open();
        if (dlg.yes) {
            /* inserting under whatever node user has focused */
            const node = S.nodeUtil.getHighlightedNode(state);

            if (!node) {
                S.util.showMessage("No node is selected.", "Warning");
            } else {
                const res = await S.rpcUtil.rpc<J.InsertBookRequest, J.InsertBookResponse>("insertBook", {
                    nodeId: node.id,
                    bookName: "War and Peace",
                    truncated: S.user.isTestUserAccount(state)
                });
                this.insertBookResponse(res, state);
            }
        }
    }

    // showIpfsTab = () => {
    //     dispatch("showIpfsTab", s => {
    //         s.showIpfsTab = true;
    //         setTimeout(() => {
    //             S.tabUtil.selectTab(C.TAB_IPFSVIEW);
    //         }, 250);
    //         return s;
    //     });
    // }

    saveClipboardToChildNode = async (parentId: string) => {
        let clipText: string = await (navigator as any)?.clipboard?.readText();
        if (clipText) {
            clipText = clipText.trim();
        }

        let blob = null;
        if (!clipText) {
            blob = await S.util.readClipboardFile();
            if (blob) {
                EditNodeDlg.pendingUploadFile = blob;
            }
        }

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

        if (!clipText && !blob) {
            S.util.flashMessage("Nothing saved clipboard is empty!", "Warning", true);
            return;
        }

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: parentId,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: clipText,
            typeLock: false,
            properties: null,
            shareToUserId: null,
            boostTarget: null,
            fediSend: false
        });

        if (blob) {
            const state = getAppState(null);
            this.createSubNodeResponse(res, false, null, null, state);
        }
        else {
            setTimeout(() => {
                const state = getAppState();
                S.view.refreshTree({
                    nodeId: null,
                    zeroOffset: true,
                    renderParentIfLeaf: false,
                    highlightId: null,
                    forceIPFSRefresh: false,
                    scrollToTop: false,
                    allowScroll: true,
                    setTab: true,
                    forceRenderParent: false,
                    state
                });
            }, 500);
        }
    }

    splitNode = async (node: J.NodeInfo, splitType: string, delimiter: string, state: AppState) => {
        node = node || S.nodeUtil.getHighlightedNode(state);

        if (!node) {
            S.util.showMessage("You didn't select a node to split.", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.SplitNodeRequest, J.SplitNodeResponse>("splitNode", {
            splitType,
            nodeId: node.id,
            delimiter
        });
        this.splitNodeResponse(res, state);
    }

    splitNodeResponse = (res: J.SplitNodeResponse, state: AppState) => {
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree({
                nodeId: null,
                zeroOffset: false,
                renderParentIfLeaf: false,
                highlightId: null,
                forceIPFSRefresh: false,
                scrollToTop: false,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                state
            });
            S.view.scrollToNode(state);
        }
    }

    addBookmark = (node: J.NodeInfo, state: AppState) => {
        this.createNode(node, J.NodeType.BOOKMARK, true, true, null, null, state);
    }

    addLinkBookmark = async (content: any, audioUrl: string, state: AppState) => {
        state = getAppState(state);

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: true,
            nodeId: null,
            newNodeName: "",
            typeName: J.NodeType.BOOKMARK,
            createAtTop: true,
            content,
            typeLock: true,
            payloadType: "linkBookmark",
            properties: audioUrl ? [{ name: J.NodeProp.AUDIO_URL, value: audioUrl }] : null,
            shareToUserId: null,
            boostTarget: null,
            fediSend: false
        });
        this.createSubNodeResponse(res, true, null, null, state);
    }

    // like==false means 'unlike'
    likeNode = async (node: J.NodeInfo, like: boolean, state: AppState) => {
        await S.rpcUtil.rpc<J.LikeNodeRequest, J.LikeNodeResponse>("likeNode", {
            id: node.id,
            like
        }, true);

        dispatch("likeNode", s => {
            node.likes = node.likes || [];

            if (like && !node.likes.find(u => u === state.userName)) {
                // add userName to likes
                node.likes.push(state.userName);
            }
            else {
                // remove userName from likes
                node.likes = node.likes.filter(u => u !== state.userName);
            }
            return s;
        });
    }

    /* If this is the user creating a 'boost' then boostTarget is the NodeId of the node being boosted */
    addNode = async (nodeId: string, typeName: string, reply: boolean, content: string, shareToUserId: string, replyToId: string, afterEditAction: Function, boostTarget: string, fediSend: boolean, state: AppState) => {
        state = getAppState(state);

        // auto-enable edit mode
        if (!state.userPrefs.editMode) {
            await this.toggleEditMode(state);
        }

        // pending edit will only be true if not a boost, becasue ActPub doesn't support posting content into a boost
        // so we save the node without any content in this case.
        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: !boostTarget,
            nodeId,
            newNodeName: "",
            typeName: typeName || J.NodeType.NONE,
            createAtTop: true,
            content,
            typeLock: false,
            properties: null,
            shareToUserId,
            boostTarget,
            fediSend
        });

        if (!boostTarget) {
            this.createSubNodeResponse(res, false, replyToId, afterEditAction, state);
        }
        else {
            S.util.flashMessageQuick("Post was boosted!", "Boost");
        }
    }

    createNode = async (node: J.NodeInfo, typeName: string, forceUsePopup: boolean, pendingEdit: boolean, payloadType: string, content: string, state: AppState) => {
        state = getAppState(state);

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit,
            nodeId: node ? node.id : null,
            newNodeName: "",
            typeName,
            createAtTop: true,
            content,
            typeLock: true,
            properties: null,
            payloadType,
            shareToUserId: null,
            boostTarget: null,
            fediSend: false
        });

        // auto-enable edit mode
        if (!state.userPrefs.editMode) {
            await this.toggleEditMode(state);
        }
        this.createSubNodeResponse(res, forceUsePopup, null, null, state);
    }

    addCalendarEntry = async (initDate: number, state: AppState) => {
        state = getAppState(state);

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: state.fullScreenConfig.nodeId,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: null,
            typeLock: true,
            properties: [{ name: J.NodeProp.DATE, value: "" + initDate }],
            shareToUserId: null,
            boostTarget: null,
            fediSend: false
        });
        this.createSubNodeResponse(res, false, null, null, state);
    }

    moveNodeByDrop = async (targetNodeId: string, sourceNodeId: string, location: string, refreshCurrentNode: boolean) => {
        // console.log("targetNodeId=" + targetNodeId);

        /* if node being dropped on itself, then ignore */
        if (targetNodeId === sourceNodeId) {
            return;
        }

        // console.log("Moving node[" + targetNodeId + "] into position of node[" + sourceNodeId + "]");
        const state = getAppState(null);

        const res = await S.rpcUtil.rpc<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId,
            nodeIds: [sourceNodeId],
            location
        });
        S.render.fadeInId = sourceNodeId;

        if (refreshCurrentNode) {
            if (S.util.checkSuccess("Move nodes", res)) {
                dispatch("SetNodesToMove", s => {
                    S.util.removeHistorySubItem(sourceNodeId);
                    s.nodesToMove = null;
                    return s;
                });
                const state = getAppState();
                S.view.refreshTree({
                    nodeId: null,
                    zeroOffset: false,
                    renderParentIfLeaf: false,
                    highlightId: null,
                    forceIPFSRefresh: false,
                    scrollToTop: false,
                    allowScroll: false,
                    setTab: false,
                    forceRenderParent: false,
                    state
                });
            }
        }
        else {
            this.moveNodesResponse(res, sourceNodeId, false, state);
        }
    }

    updateHeadings = async (state: AppState) => {
        state = getAppState(state);
        const node = S.nodeUtil.getHighlightedNode(state);
        if (node) {
            await S.rpcUtil.rpc<J.UpdateHeadingsRequest, J.UpdateHeadingsResponse>("updateHeadings", {
                nodeId: node.id
            });
            S.quanta.refresh(state);
        }
    }

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    editNodeSharing = async (state: AppState, node: J.NodeInfo) => {
        node = node || S.nodeUtil.getHighlightedNode(state);

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg: SharingDlg = new SharingDlg();
        await dlg.open();
    }

    /* Whenever we share an encrypted node to a another user, this is the final operation we run which
   generates a key to the data which is encrypted with the public key of the person (identified by principalNodeId)
   the node is shared to. Then publishes that key info into the DB, so that only the other person who this node is shared to
   can use their private key to decrypt the key to the data, to view the node.
   */
    addCipherKeyToNode = async (node: J.NodeInfo, principalPublicKeyStr: string, principalNodeId: string) => {
        if (principalNodeId === "public" || !S.crypto.avail) {
            console.warn("public node has encryption turned on. This is a bug.");
            return;
        }
        // console.log("PrincipalPublicKeyStr:" + principalPublicKeyStr + " principalNodeId:" + principalNodeId);

        // get the asym-encrypted sym Key to this node (decryptable by owner of node only, which is us)
        const cipherKey = S.props.getPropStr(J.NodeProp.ENC_KEY, node);
        // console.log("cipherKey on ENC_KEY: "+cipherKey);

        // get this broswer's private key from browser storage
        const privateKey: CryptoKey = await S.crypto.getPrivateEncKey();

        // so this is the decrypted symmetric key to the data (the unencrypted copy of the actual AES key to the data)
        const clearKey = await S.crypto.asymDecryptString(privateKey, cipherKey);
        if (!clearKey) {
            throw new Error("Unable to access encryption key.");
        }

        // console.log("clear text key to re-encrypt: " + clearKey + "\nEncrpyting key using this pub key of user: " +
        //     principalPublicKeyStr);

        // first parse the key and build a usable key from principalPublicKey.
        const principalSymKeyJsonObj: JsonWebKey = JSON.parse(principalPublicKeyStr);
        const principalPublicKey = await S.crypto.importKey(principalSymKeyJsonObj, S.crypto.ASYM_IMPORT_ALGO, true, S.crypto.OP_ENC);

        // now re-encrypt this clearTextKey using the public key (of the user being shared to).
        const userCipherKey = await S.crypto.asymEncryptString(principalPublicKey, clearKey);
        // console.log("userCipherKey=" + userCipherKey);

        /* Now post this encrypted key (decryptable only by principalNodeId's private key) up to the server which will
        then store this key alongside the ACL (access control list) for the sharing entry for this user */
        await S.rpcUtil.rpc<J.SetCipherKeyRequest, J.SetCipherKeyResponse>("setCipherKey", {
            nodeId: node.id,
            principalNodeId,
            cipherKey: userCipherKey
        });
    }

    updateNode = (node: J.NodeInfo) => {
        dispatch("UpdateNode", s => {
            s.editNode = node;
            return s;
        });
    }
}
