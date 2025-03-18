import { dispatch, getAs, promiseDispatch, StateModFunc } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Anchor } from "./comp/core/Anchor";
import { VerticalLayout } from "./comp/core/VerticalLayout";
import { TabPanel } from "./comp/TabPanel";
import { Constants as C } from "./Constants";
import { AskAboutSubgraphDlg } from "./dlg/AskAboutSubgraphDlg";
import { AskNodeLinkNameDlg } from "./dlg/AskNodeLinkNameDlg";
import { ConfigureAgentDlg } from "./dlg/ConfigureAIDlg";
import { ConfirmDlg } from "./dlg/ConfirmDlg";
import { EditBlockedWordsDlg } from "./dlg/EditBlockedWordsDlg";
import { EditNodeDlg } from "./dlg/EditNodeDlg";
import { EditTagsDlg } from "./dlg/EditTagsDlg";
import { ExportDlg } from "./dlg/ExportDlg";
import { GenerateBookByAIDlg } from "./dlg/GenerateBookByAIDlg";
import { MessageDlg } from "./dlg/MessageDlg";
import { SetNodeUsingJsonDlg } from "./dlg/SetNodeUsingJsonDlg";
import { SharingDlg } from "./dlg/SharingDlg";
import { UploadFromFileDropzoneDlg } from "./dlg/UploadFromFileDropzoneDlg";
import { FullScreenType } from "./Interfaces";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo, PrincipalName } from "./JavaIntf";
import { ResultSetInfo } from "./ResultSetInfo";
import { S } from "./Singletons";
import { DocumentTab } from "./tabs/data/DocumentTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { MainTab } from "./tabs/data/MainTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { DocumentView } from "./tabs/DocumentView";
import { Tailwind } from "./Tailwind";
import { TimelineRSInfo } from "./TimelineRSInfo";

export class Edit {
    showReadOnlyProperties = false;
    helpNewUserEditCalled = false;

    _postFromTimeline = () => {
        const ast = getAs();
        if (ast.isAnonUser) {
            S.util.showMessage("Login to create content and reply to nodes.", "Login!");
        }
        else {
            const info = TimelineTab.inst.props as TimelineRSInfo;
            S.edit.addNode(info.node.id, J.NodeType.COMMENT, null, null);
        }
    }

    async deleteBookmark(id: string, name: string) {
        const dlg = new ConfirmDlg("Confirm Delete Bookmark: " + name, "Warning");
        await dlg.open();
        if (dlg.yes) {
            await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: [id],
                childrenOnly: false,
                bulkDelete: false,
                jumpToParentOf: null,
                force: true
            });
            setTimeout(S.util._loadBookmarks, 100);
        }
    }

    async saveNode(node: NodeInfo, returnInlineChildren: boolean) {
        const res = await S.rpcUtil.rpc<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
            node,
            returnInlineChildren
        });

        S.nodeUtil.processInboundNode(res.node);
        if (res?.code != C.RESPONSE_CODE_OK) {
            return false;
        }
        S.render.fadeInId = res.node.id;

        // note: newNodeTargetId is only set when we're inserting a new node into the page, and not
        // when we're expanding a node that's already on the page. Ditto for newNodeTargetOffset.
        await S.edit.saveNodeResponse(res.node, res, S.quanta.newNodeTargetId, S.quanta.newNodeTargetOffset);
        S.util.notifyNodeUpdated(res.node.id, res.node.type);
        return true;
    }

    async toggleUserExpansion(node: NodeInfo) {
        const res = await S.rpcUtil.rpc<J.SetExpandedRequest, J.SetExpandedResponse>("toggleNodeExpanded", {
            nodeId: node.id
        });

        // can this method be rolled into 'injectUpdatedNode' ?
        S.nodeUtil.processInboundNode(res.node);

        if (res?.code != C.RESPONSE_CODE_OK) {
            return false;
        }

        S.render.fadeInId = res.node.id;
        await this.injectUpdatedNode(res.node);
        S.util.notifyNodeUpdated(res.node.id, res.node.type);
    }

    _editHashtags = async () => {
        const dlg = new EditTagsDlg();
        await dlg.open();
    }

    _editBlockedWords = async () => {
        const dlg = new EditBlockedWordsDlg();
        await dlg.open();
    }

    _openImportDlg = (): any => {
        const node = S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const dlg = new UploadFromFileDropzoneDlg(node.id, "", null, true, true, () => {
            S.view.jumpToId(node.id);
        }, true);
        dlg.open();
    }

    _openExportDlg = async () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            const dlg = new ExportDlg(node.name, node.id, false);
            await dlg.open();
            this.exportResponse(dlg.res);
        }
    }

    exportResponse(res: J.ExportResponse) {
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but
        eventually the plan is to have the export return the actual md5 of the export for use here
        */
        // disp=inline (is the other)
        const downloadLink = S.util.getHostAndPort() + "/f/export/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file.",
                "Export",
                null,
                new VerticalLayout([
                    new Anchor(downloadLink, "Download", { target: "_blank" }),
                ]), false, 0, null
            ).open();

            S.view.scrollToNode();
        }
    }

    public async initNodeEditResponse(res: J.InitNodeEditResponse, encrypt: boolean,
        showJumpButton: boolean, afterEditJumpToId: string) {

        if (S.util.checkSuccess("Editing node", res)) {
            const editingAllowed = this.isEditAllowed(res.nodeInfo);
            if (editingAllowed) {
                /* Either run the node editor as a popup or embedded, depending on whether we have a fullscreen
                calendar up and wether we're on the main tab, etc */
                await promiseDispatch("startEditing", s => {
                    s.editNode = res.nodeInfo;
                    s.afterEditJumpToId = afterEditJumpToId;
                });
                const dlg = new EditNodeDlg(encrypt, showJumpButton, null);
                dlg.open();
            } else {
                S.util.showMessage("Editing not allowed on node.", "Warning");
            }
        }
    }

    private setNodePositionResponse(res: J.SetNodePositionResponse, id: string) {
        if (S.util.checkSuccess("Change node position", res)) {
            S.view.jumpToId(id, true);
            S.util.notifyNodeMoved();
        }
    }

    /* returns true if we are admin or else the owner of the node */
    isEditAllowed(node: any): boolean {
        const ast = getAs();
        if (!node) return false;
        if (ast.isAdminUser) return true;

        // if no owner treat as if admin owns
        return ast.userName === (node.owner || PrincipalName.ADMIN);
    }

    /*  
      Creates a new node under parentId node. 

      If `insertAtLoc` is non-null it holds the node whose offset is where the new node will be
      inserted, and this will be an insert inline kind of insert.
    */
    async startEditingNewNode(createAtTop: boolean, parentId: string, siblingId: string, insertAtLoc: NodeInfo,
        ordinalOffset: number, threadViewAiQuestion: boolean) {
        const afterEditJumpToId = createAtTop ? parentId : null;

        if (S.util.ctrlKeyCheck()) {
            let blob = null;
            const clipboardText = await (navigator as any)?.clipboard?.readText();
            if (!clipboardText) {
                blob = await S.util.readClipboardFile();
                if (blob) {
                    EditNodeDlg.pendingUploadFile = blob;
                }
            }

            // doing an inline insert
            if (insertAtLoc) {
                const res = await S.rpcUtil.rpc<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                    pendingEdit: false,
                    parentId,
                    siblingId,
                    targetOrdinal: insertAtLoc.ordinal + ordinalOffset,
                    newNodeName: "",
                    typeName: J.NodeType.NONE,
                    initialValue: clipboardText,
                    aiMode: J.Constant.AI_MODE_CHAT
                });
                S.nodeUtil.applyNodeChanges(res?.nodeChanges);
                if (blob) {
                    this.insertNodeResponse(res);
                }
            }
            // inserting a subnode under parent
            else {
                const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    pendingEdit: false,
                    nodeId: parentId,
                    aiRequest: false,
                    newNodeName: "",
                    typeName: J.NodeType.NONE,
                    createAtTop,
                    content: clipboardText,
                    typeLock: false,
                    properties: null,
                    shareToUserId: null,
                    payloadType: null,
                    aiMode: getAs().userPrefs.aiMode,
                    allowAiOverwrite: false
                });

                S.nodeUtil.applyNodeChanges(res?.nodeChanges);
                if (blob) {
                    this.createSubNodeResponse(res, afterEditJumpToId);
                }
            }

            if (!blob) {
                S.quanta.refresh();
            }
        }
        else {
            if (insertAtLoc) {
                const res = await S.rpcUtil.rpc<J.InsertNodeRequest, J.InsertNodeResponse>("insertNode", {
                    pendingEdit: true,
                    parentId,
                    siblingId,
                    targetOrdinal: insertAtLoc.ordinal + ordinalOffset,
                    newNodeName: "",
                    typeName: J.NodeType.NONE,
                    initialValue: "",
                    aiMode: getAs().userPrefs.aiMode
                });
                S.nodeUtil.applyNodeChanges(res?.nodeChanges);
                this.insertNodeResponse(res);
            } else {
                const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
                    pendingEdit: true,
                    nodeId: parentId,
                    aiRequest: false,
                    newNodeName: "",
                    typeName: J.NodeType.NONE,
                    createAtTop,
                    content: null,
                    typeLock: false,
                    properties: null,
                    shareToUserId: null,
                    payloadType: null,
                    aiMode: getAs().userPrefs.aiMode,
                    allowAiOverwrite: false
                });

                if (threadViewAiQuestion) {
                    dispatch("AppendToThreadResults", s => {
                        const data = ThreadTab.inst;
                        if (!data) return;
                        data.props.results.push(res.newNode);
                        s.threadViewQuestionId = res.newNode.id;
                    });
                }
                else {
                    S.nodeUtil.applyNodeChanges(res?.nodeChanges);
                }
                this.createSubNodeResponse(res, afterEditJumpToId);
            }
        }
    }

    insertNodeResponse(res: J.InsertNodeResponse) {
        if (S.util.checkSuccess("Insert node", res)) {
            S.nodeUtil.highlightNode(res.newNode, false, getAs());
            this.runEditNode(null, res.newNode.id, false, false, false, null);
        }
    }

    createSubNodeResponse(res: J.CreateSubNodeResponse, afterEditJumpToId: string) {
        if (S.util.checkSuccess("Create subnode", res)) {
            if (!res.newNode) {
                S.quanta.refresh();
            }
            else {
                this.runEditNode(null, res.newNode.id, res.encrypt, false, //
                    false, afterEditJumpToId);
            }
        }
    }

    async saveNodeResponse(node: NodeInfo, res: J.SaveNodeResponse, newNodeTargetId: string, newNodeTargetOffset: number) {
        const ast = getAs();
        if (S.util.checkSuccess("Save node", res)) {
            await this.distributeKeys(node, res.aclEntries);

            // if feed tab became dirty while we were editing then refresh it.
            if (FeedTab.inst?.props?.feedDirtyList) {
                for (const node of FeedTab.inst.props.feedDirtyList) {
                    S.push.forceFeedItem(node);
                }
                FeedTab.inst.props.feedDirtyList = null;

                // all the data in feedData will have been updated by forceFeedItem so force react to render now.
                dispatch("ForceFeedResults", _s => { });
            }

            // It's possible to end up editing a node that's not even on the page, or a child of a
            // node on the page, and so before refreshing the screen we check for that edge case.
            const parentPath = S.props.getParentPath(node);
            if (!parentPath) return;

            const newNode = res.node;
            if (!newNodeTargetId) {
                // This upates the node in browser memory IF it's already in browser memory.
                this.injectUpdatedNode(newNode);
            }

            S.histUtil.updateNodeHistory(newNode, false);
            if (ast.activeTab === C.TAB_MAIN) {
                // Inject the new node right into the page children
                if (newNodeTargetId) {
                    await this.injectNewNodeIntoChildren(newNode, newNodeTargetId, newNodeTargetOffset);
                }
                // any kind of insert that's not a new node injected into the page ends up here.
                else {
                    // Note the special case here for bookmark. We never want to jump to a bookmark
                    // just because it got updated. That would take us away from whatever we're
                    // working on and is never right.
                    if (node.type !== J.NodeType.BOOKMARK && !S.nodeUtil.displayingOnTree(node.id)) {
                        S.view.jumpToId(ast.afterEditJumpToId || node.id);
                    }
                }
            }
            else if (ast.activeTab === C.TAB_DOCUMENT) {
                const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
                if (data) {
                    S.srch.showDocument(data.props.node.id, false, null);
                }
            }

            if (ast.fullScreenConfig.type === FullScreenType.CALENDAR) {
                S.render.showCalendar(ast.fullScreenConfig.nodeId);
            }
        }
    }

    async injectUpdatedNode(node: NodeInfo) {
        await promiseDispatch("nodeUpdated", s => {
            // if the node is our page parent (page root)
            if (node.id === s.node?.id) {
                // preserve the children, when updating the root node, because they will not have been obtained
                // due to the 'singleNode=true' in the request
                node.children = s.node.children;
                s.node = node;
            }

            getAs().tabData.forEach(td => td.replaceNode(s, node));
        });
    }

    replaceNodeRecursive(node: NodeInfo, newNode: NodeInfo): void {
        if (!node || !node.children) return;

        node.children = node.children.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });

        node.children.forEach(n => this.replaceNodeRecursive(n, newNode));
    }

    // This must insert newNode into the local browser memory. We know newNodeTargetId is a sibling
    // node of newNode, and newNodeTargetOffset is 0 if we're inserting above, and 1 if we're
    // inserting below.
    injectNewNodeIntoChildren(newNode: NodeInfo, newNodeTargetId: string, newNodeTargetOffset: number): Promise<void> {
        // we return the promise from the dispatch and to not wait for it here.
        return promiseDispatch("InjectNewNodeIntoChildren", s => {
            const parentPath = S.props.getParentPath(newNode);
            if (!parentPath) return;
            const node = MainTab.inst?.findNodeByPath(parentPath, s);
            if (node) {
                this.pushNodeIntoChildren(node, newNode, newNodeTargetId, newNodeTargetOffset);
            }
        });
    }

    pushNodeIntoChildren(node: NodeInfo, newNode: NodeInfo, newNodeTargetId: string, newNodeTargetOffset: number): void {
        if (node.children) {
            const newChildren: NodeInfo[] = [];

            // we'll be renumbering ordinals so use this to keep track, by starting at whatever
            // the first child was at before the insert
            let ord = node.children[0].logicalOrdinal;

            // build newChildren by inserting the 'newNode' into it's proper place into the children array.
            node.children.forEach(child => {
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
            node.children = newChildren;
        }
        else {
            node.children = [newNode];
        }
    }

    // NOT CURRENTLY USED (but let's keep for future possible needs)
    //
    // refreshNodeFromServer = async (nodeId: string, newNodeTargetId: string): Promise<J.NodeInfo> => {
    //     return new Promise<J.NodeInfo>( async (resolve, reject) => {
    //         const ast = getAst();

    //         const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
    //             nodeId,
    //             upLevel: false,
    //             siblingOffset: 0,
    //             forceRenderParent: false,
    //             offset: 0,
    //             goToLastPage: false,
    //             singleNode: true,
    //             jumpToRss: false
    //         });

    //         if (!res || !res.node) {
    //             resolve(null);
    //             return;
    //         }

    //         resolve(res.node);

    //         // we only need to update/dispatch here if we're NOT doing an 'insert into page' type insert
    //         if (!newNodeTargetId) {
    //             await promiseDispatch("RefreshNodeFromServer", s => {
    //                 // if the node is our page parent (page root)
    //                 if (res.node.id === s.node?.id) {
    //                     // preserve the children, when updating the root node, because they will not have been obtained
    //                     // due to the 'singleNode=true' in the request
    //                     res.node.children = s.node.children;
    //                     s.node = res.node;
    //                 }

    //                 // make all tabs update their copy of the node of they have it
    //                 ast.tabData.forEach(td => td.replaceNode(s, res.node));
    //             });
    //         }
    //     });
    // }

    async distributeKeys(node: NodeInfo, aclEntries: J.AccessControlInfo[]) {
        if (!aclEntries || !S.props.isEncrypted(node)) {
            return;
        }

        for (const ac of aclEntries) {
            await this.addCipherKeyToNode(node, ac.publicKey, ac.principalNodeId);
        }
    }

    async setRssHeadlinesOnly(val: boolean) {
        S.util.saveUserPrefs(s => s.userPrefs.rssHeadlinesOnly = val);
    }

    setMainPanelCols(val: number) {
        setTimeout(() => {
            if (val < 4) val = 4;
            if (val > 8) val = 8;
            S.util.saveUserPrefs(s => s.userPrefs.mainPanelCols = val);
        }, 100);
    }

    // saveTabsTopmostVisibie and scrollTabsTopmostVisible should always be called as a pair
    saveTabsTopmostVisible = async (): Promise<boolean> => {
        let doScrolling = false;
        const ast = getAs();

        // in this loop record the currently topmost visible element in each tab, so we can scroll
        // those back it view after doing some change to the DOM that will potentially cause the
        // page to jump to a different effective scroll position.
        for (const data of ast.tabData) {
            // Warning: Uninitialized tabs will have 'scrollPos==undefined' here, so we check for
            // that case, because otherwise it will get interpreted as a number We do nothing if
            // user hasn't scrolled down enough to loose their place when the screen rerenders.
            if (data.scrollPos == null || data.scrollPos === undefined || data.scrollPos < window.innerHeight / 2) {
                // do nothing, if window isn't scrolled hafway at least
            }
            else {
                doScrolling = true;
                // NOTE: This is tricky here, but correct. The first 'id' is an ID, and the second
                // one is a "class" (passed as arguments into findFirstVisibleElm), and this is not
                // a bug. It's just a coincidence that 'data.id' is the correct thing to use for
                // both parameters per what's in the DOM.
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
    scrollTabsTopmostVisible = () => {
        // this timer is because all scrolling in browser needs to be delayed or we can have failures.
        setTimeout(() => {
            // scroll into view whatever was the topmost item
            for (const data of getAs().tabData) {
                if (data.topmostVisibleElmId) {
                    // we have to lookup the element again, because our DOM will have rendered and we will likely
                    // have a new actual element.
                    const elm = document.getElementById(data.topmostVisibleElmId);
                    if (elm) {
                        // scrollIntoView works, but is off a bit because we have a 'sticky' header covering up
                        // part of the window making scrollIntoView appaer not to work.
                        // elm.scrollIntoView(true);
                        data.inst.scrollToElm(elm);
                    }
                }
            }
            setTimeout(() => {
                TabPanel.inst.setVisibility(true);
            }, 250);
        }, 250);
    }

    // WARNING: This func is expected to NOT alter that the active tab is!
    async runScrollAffectingOp(func: () => void) {
        const doScrolling = await this.saveTabsTopmostVisible();
        if (doScrolling) {
            // turn off Comp stuff so it doesn't interfere with what we're about to do with scrolling.
            Comp.allowScrollSets = false;
        }
        await func();

        if (doScrolling) {
            this.scrollTabsTopmostVisible();
            Comp.allowScrollSets = true;
        }
    }

    // We allow a function (func) to run here in such a way that the scroll positions of every tab
    // panel are maintained so the user doesn't loose their place after the screen completely
    // updates.
    setUserPreferenceVal(mod: StateModFunc) {
        this.runScrollAffectingOp(() => S.util.saveUserPrefs(mod));
    }

    async setEditMode(val: boolean) {
        this.setUserPreferenceVal(s => s.userPrefs.editMode = val);
    }

    async setAiMode(val: string) {
        this.setUserPreferenceVal(s => s.userPrefs.aiMode = val);
    }

    setShowMetaData(val: boolean) {
        this.setUserPreferenceVal(s => s.userPrefs.showMetaData = val);
    }

    // #add-prop
    async setAutoRefreshFeed(autoRefreshFeed: boolean) {
        return S.util.saveUserPrefs(s => s.userPrefs.autoRefreshFeed = autoRefreshFeed);
    }

    async setShowComments(showReplies: boolean): Promise<void> {
        return S.util.saveUserPrefs(s => s.userPrefs.showReplies = showReplies);
    }

    async setShowReplies(showReplies: boolean) {
        await S.util.saveUserPrefs(s => s.userPrefs.showReplies = showReplies);

        const ast = getAs();
        // todo-2: we need a PubSub broadcast event for "SHOW_REPLIES_CHANGED" that we can send out to all tabs.
        if (ast.activeTab === C.TAB_MAIN) {
            S.quanta.refresh();
        }
        else if (ast.activeTab === C.TAB_DOCUMENT) {
            const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
            if (data) {
                S.srch.showDocument(data.props.node.id, true, null);
            }
        }
        else {
            // update render state (using local state), this way if we're not refreshing the tree.
            dispatch("setShowReplies", s => {
                s.userPrefs.showReplies = ast.userPrefs.showReplies;
            });
        }
    }

    async moveNodeUp(id: string) {
        const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
            nodeId: id,
            targetName: "up"
        });
        this.setNodePositionResponse(res, id);
    }

    async moveNodeDown(id: string) {
        const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
            nodeId: id,
            targetName: "down"
        });
        this.setNodePositionResponse(res, id);
    }

    _moveUp = async () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.moveNodeUp(node.id);
        }
    }

    _moveDown = async () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.moveNodeDown(node.id);
        }
    }

    _moveNodeToTop = async () => {
        const selNode = S.nodeUtil.getHighlightedNode();
        const id = selNode?.id;

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "top"
            });
            S.nodeUtil.applyNodeChanges(res?.nodeChanges);
            this.setNodePositionResponse(res, id);
        }
    }

    _moveNodeToBottom = async () => {
        const selNode = S.nodeUtil.getHighlightedNode();
        const id = selNode?.id;

        if (id) {
            const res = await S.rpcUtil.rpc<J.SetNodePositionRequest, J.SetNodePositionResponse>("setNodePosition", {
                nodeId: id,
                targetName: "bottom"
            });
            this.setNodePositionResponse(res, id);
        }
    }

    getFirstChildNode(): any {
        const ast = getAs();
        if (!ast.node || !ast.node.children || ast.node.children.length === 0) return null;
        return ast.node.children[0];
    }

    getLastChildNode(): NodeInfo {
        const ast = getAs();
        if (!ast.node || !ast.node.children || ast.node.children.length === 0) return null;
        return ast.node.children[ast.node.children.length - 1];
    }

    checkEditPending(): boolean {
        const ast = getAs();

        // state.editNode holds non-null always whenever there is editing underway.
        if (ast.editNode) {
            S.util.showMessage("You're already editing a node. Finish that edit first. Tip: Use `Menu -> Edit -> Resume Editing` if you forgot which node you're editing.", "Warning");
            return true;
        }
        return false;
    }

    _runEditNodeByClick = async (evt: Event, id: string) => {
        // This is a hindrance when going down thru a page and editing all the content, so just for
        // this case I'll allow the abandoment of any content being edited, and start editing a new
        // node editing without asking user to confirm.
        // if (this.checkEditPending()) return;
        if (getAs().editNode) {
            EditNodeDlg.dlg.utl.cancelEdit();
            setTimeout(() => this.runEditNodeByClickImmediate(evt, id), 500);
        }
        else {
            this.runEditNodeByClickImmediate(evt, id);
        }
    }

    async runEditNodeByClickImmediate(evt: Event, id: string) {
        id = S.util.allowIdFromEvent(evt, id);

        // we set noScrollToId just to block the future attempt (one time) to
        // scroll to this, because this is a hint telling us we are ALREADY
        // scrolled to this ID so any scrolling will be unnecessary
        S.quanta.noScrollToId = id;
        this.runEditNode(null, id, false, false, false, null);

        // it's safest and best to just disable scrolling for a couple of seconds during which editing is being initiated.
        setTimeout(() => {
            S.quanta.noScrollToId = null;
        }, 2000);
    }

    /* This can run as an actuall click event function in which only 'evt' is non-null here */
    async runEditNode(overrideContent: string, id: string, encrypt: boolean,
        showJumpButton: boolean, editMyFriendNode: boolean, afterEditJumpToId: string) {
        if (S.quanta.config.requireCrypto && !S.crypto.avail) {
            S.util.showMessage("Crypto support not available", "Warning");
            return;
        }

        if (!id) {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                id = node.id;
            }
        }

        if (!id) {
            S.util.showMessage("Unknown nodeId in editNodeClick: ", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            nodeId: id,
            editMyFriendNode
        });

        if (res.nodeInfo && overrideContent) {
            res.nodeInfo.content = overrideContent;
        }

        this.initNodeEditResponse(res, encrypt, showJumpButton, afterEditJumpToId);
    }

    /* Inserts a new node as a sibling of 'id' and at id's ordinal + 'ordinalOffset' */
    async insertNode(id: string, ordinalOffset: number, ast?: AppState) {
        if (this.checkEditPending()) return;

        /*
         * We get the node selected for the insert position by using the uid if one was passed in or using the
         * currently highlighted node if no uid was passed.
         */
        let node: NodeInfo = MainTab.inst?.findNode(id, ast);
        if (!node) {
            node = DocumentTab.inst.findNode(id);
        }

        if (node) {
            S.quanta.newNodeTargetId = id;
            S.quanta.newNodeTargetOffset = ordinalOffset;
            this.startEditingNewNode(false, null, node.id, node, ordinalOffset, false);
        }
    }

    _askAiFromThreadView = async (evt: Event, id: string) => {
        if (this.checkEditPending()) return;
        id = S.util.allowIdFromEvent(evt, id);
        const ast = getAs();
        this.startEditingNewNode(true, id || ast.node.id, null, null, 0, true);
    }

    _newSubNode = async (evt: Event, id: string) => {
        if (this.checkEditPending()) return;

        id = S.util.allowIdFromEvent(evt, id);
        const ast = getAs();

        if (S.util.ctrlKeyCheck()) {
            await this.saveClipboardToChildNode(id, null);
            S.view.jumpToId(id);
        }
        else {
            this.startEditingNewNode(true, id || ast.node.id, null, null, 0, false);
        }
    }

    async clearInbox() {
        const ast = getAs();
        S.nodeUtil._clearSelNodes();

        const dlg = new ConfirmDlg("Permanently delete the nodes in your Inbox", "Clear Inbox",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (dlg.yes) {
            await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: ["~" + J.NodeType.INBOX],
                childrenOnly: true,
                bulkDelete: false,
                jumpToParentOf: null,
                force: true
            });
            S.nav.openContentNode(ast.userProfile.userNodeId, false);
        }
    }

    _subGraphHash = async () => {
        const node = S.nodeUtil.getHighlightedNode();

        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        S.rpcUtil.rpc<J.SubGraphHashRequest, J.SubGraphHashResponse>("subGraphHash", {
            nodeId: node.id,
            recursive: true
        }).then((res: J.SubGraphHashResponse) => {
            if (res.code == C.RESPONSE_CODE_OK) {
                S.util.showMessage(res.message);
            }
            else {
                S.util.showMessage("operation failed.");
            }
        });

        S.util.showMessage("Request sumitted. Check the node for property " + J.NodeProp.SUBGRAPH_HASH);
    }

    _joinNodes = async () => {
        const selNodesArray = S.nodeUtil.getSelNodeIdsArray();
        if (!selNodesArray || selNodesArray.length < 2) {
            S.util.showMessage("Select nodes to join.", "Warning");
            return;
        }

        const confirmMsg = "Join " + selNodesArray.length + " node(s) ?";
        const dlg = new ConfirmDlg(confirmMsg, "Confirm Join");
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.JoinNodesRequest, J.JoinNodesResponse>("joinNodes", {
                nodeIds: selNodesArray
            });
            const ast = getAs();
            if (S.util.checkSuccess("Join node", res)) {
                S.nodeUtil._clearSelNodes();
                S.view.refreshTree({
                    nodeId: ast.node.id,
                    zeroOffset: false,
                    highlightId: null,
                    scrollToTop: false,
                    allowScroll: true,
                    setTab: true,
                    forceRenderParent: false,
                    jumpToRss: false
                });
            }
        }
    }

    /*
    * Deletes all nodes owned by you but NOT rooted in your own account root.
    */
    _bulkDelete = async () => {
        const confirmMsg = "Bulk Delete all your nodes *not* rooted in your account?";
        const dlg = new ConfirmDlg(confirmMsg, "Confirm Delete",
            "-danger", Tailwind.alertDanger);
        await dlg.open();
        if (dlg.yes) {
            const res = await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                nodeIds: null,
                childrenOnly: false,
                bulkDelete: true,
                jumpToParentOf: null,
                force: true
            });
            S.util.showMessage(res.message, "Message");
        }
    }

    // clears selections before deleting so only the id passed or the id on the event can be
    // deleted. This is because non-tree views don't have the checkbox for even multiselecting
    _deleteOneNode = async (evt: Event = null, id: string = null) => {
        // if fullscreen (Graph or Calendar) is active, we must delete immediately rather than the normal flow of showing a confirmation on the node first.
        if (S.util.fullscreenViewerActive()) {
            S.edit.immediateDeleteSelNodes([id]);
            return;
        }

        await promiseDispatch("ClearSelectNode", s => s.selectedNodes.clear());

        // now we can run this method and we know it will only delete one node.
        this._deleteSelNodes(evt, id);
    }

    /*
     * Deletes the selNodesArray items, and if none are passed then we fall back to using whatever
     * the user has currenly selected (via checkboxes)
     */
    _deleteSelNodes = async (evt: Event = null, id: string = null) => {
        id = S.util.allowIdFromEvent(evt, id);

        // if a nodeId was specified we use it as the selected node to delete
        if (id) {
            await promiseDispatch("SelectNode", s => S.nav.setNodeSel(true, id, s));
        }

        const ast = getAs();
        // note: the setNodeSel above isn't causing this to get anything here
        const selNodesArray: string[] = S.nodeUtil.getSelNodeIdsArray();

        if (!selNodesArray || selNodesArray.length === 0) {
            S.util.showMessage("Select some nodes to delete.", "Warning");
            return;
        }

        if (selNodesArray.find(id => id === ast.userProfile?.userNodeId)) {
            S.util.showMessage("You can't delete your account root node!", "Warning");
            return;
        }

        // if CTRL key down to instant delete
        if (S.util.ctrlKeyCheck()) {
            S.edit.immediateDeleteSelNodes(selNodesArray);
        }
        // else confirm by user before deleting.
        else {
            dispatch("ConfirmingDelete", s => {
                s.nodeClickedToDel = id;
                s.nodesToDel = selNodesArray;
            });
        }
    }

    afterDeleteCleanup(selNodesArray: string[]) {
        dispatch("AfterDeleteCleanup", s => {
            // remove this node from all data from all the tabs, so they all refresh without
            // the deleted node without being queries from the server again.
            selNodesArray.forEach(id => S.srch.removeNodeById(id, s));
            s.selectedNodes.clear();
        });
    }

    removeNodesFromCalendarData(selNodesArray: string[]) {
        dispatch("UpdateCalendarData", s => {
            selNodesArray.forEach(id => {
                if (!s.calendarData) return;
                s.calendarData = s.calendarData.filter((item: any) => item.id !== id);
            });
        });
    }

    _setUsingJson = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node)
            new SetNodeUsingJsonDlg(node.id).open();
    }

    _undoCutSelNodes = () => {
        dispatch("SetNodesToMove", s => {
            s.nodesToMove = null;
            s.cutCopyOp = null;
        });
    }

    _copySelNodes = () => {
        dispatch("CopySelNodes", s => {
            s.nodesToMove = S.nodeUtil.getSelNodeIdsArray();

            // use highlihted node if no nodes are selected
            if (!s.nodesToMove || s.nodesToMove.length === 0) {
                const node = S.nodeUtil.getHighlightedNode();
                if (node) {
                    s.nodesToMove = [node.id];
                }
            }
            s.cutCopyOp = "copy";
            s.selectedNodes.clear();
        });
    }

    _cutSelNodes = () => {
        dispatch("SetNodesToMove", s => {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                S.nav.setNodeSel(true, node.id, s);
            }

            s.nodesToMove = S.nodeUtil.getSelNodeIdsArray();
            s.cutCopyOp = "cut";
            s.selectedNodes.clear();
        });
    }

    _pasteSelNodesInside = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        const ast = getAs();
        this.pasteSelNodes(id, "inside", ast);
    }

    async pasteSelNodes(nodeId: string, location: string, ast?: AppState) {
        ast = ast || getAs();
        console.log("action nodesToMove: " + S.util.prettyPrint(ast.nodesToMove));

        const node = S.nodeUtil.findNode(nodeId);
        if (node) {
            S.histUtil.pushTreeHistory(node);
        }

        /*
         * For now, we will just cram the nodes onto the end of the children of the currently
         * selected page (for the 'inside' option). Later on we can get more specific about allowing
         * precise destination location for moved nodes.
         */
        const res = await S.rpcUtil.rpc<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId: nodeId,
            nodeIds: ast.nodesToMove,
            location,
            copyPaste: ast.cutCopyOp === "copy",
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        if (S.util.checkSuccess("Move nodes", res)) {
            dispatch("SetNodesToMove", s => {
                s.nodesToMove = null;
                s.cutCopyOp = null;
            });

            S.view.refreshTree({
                nodeId: null,
                zeroOffset: false,
                highlightId: nodeId,
                scrollToTop: false,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                jumpToRss: false
            });
        }
    }

    _pasteSelNodes_InlineAbove = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline-above");
    }

    _pasteSelNodes_Inline = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        this.pasteSelNodes(id, "inline");
    }

    async askAiQuestion(node: J.NodeInfo) {
        const ast = getAs();

        // First check for inconsistency about what the user's intention might be. Writing Mode uses query template, and non-writing mode uses
        // just the node content as the prompt
        if (ast.userPrefs.aiMode == J.Constant.AI_MODE_WRITING) {
            if (!S.props.getProp(J.NodeProp.AI_QUERY_TEMPLATE, node)) {
                S.util.showMessage("When `Writing Mode` is enabled, your questions are expected to be in a prompt property on the node. " +
                    "When you create a new node with `Writing Mode` enabled it creates this prompt property for you automatically."
                    , "Warning");
                return;
            }
        }
        else {
            if (S.props.getProp(J.NodeProp.AI_QUERY_TEMPLATE, node)) {
                S.util.showMessage("You need to enable `Writing Mode` if you want to ask questions using the prompt property of this node.", "Warning");
                return;
            }
        }

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: node.id,
            aiRequest: true,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: "",
            typeLock: false,
            properties: null,
            shareToUserId: null,
            payloadType: null,
            aiMode: ast.userPrefs.aiMode,

            // this flag means if the node has an AI template on it, we use that as the prompt and then overwrite content with the answer
            // rather than the normal behavior of putting the AI answer in a subnode
            allowAiOverwrite: true
        });

        if (res.code == C.RESPONSE_CODE_OK) {
            let jumpToNode = true;
            // if we're asking a question from the thread view, we need to append the new node to the thread results
            const ast = getAs();

            const contentOverwrite = !!S.props.getProp(J.NodeProp.AI_QUERY_TEMPLATE, res.newNode);
            // if user is asking a question and we're not on the thread tab, then jump to the thread
            // tab and display it from the hiearcharcy above the answer (thread is being displayed
            // for answer node)
            if (!contentOverwrite && ast.activeTab !== C.TAB_THREAD) {
                S.srch.showThread(res.newNode.id);
                jumpToNode = false;
            }
            else if (!contentOverwrite && ast.threadViewQuestionId === node.id && ast.activeTab == C.TAB_THREAD) {
                dispatch("AppendToThreadResults", s => {
                    const data = ThreadTab.inst;
                    if (!data) return;
                    data.props.results.push(res.newNode);
                    s.threadViewQuestionId = null;
                });
                jumpToNode = false;
            }
            else {
                S.nodeUtil.applyNodeChanges(res?.nodeChanges);
            }

            dispatch("setShowGptCredit", s => {
                s.showGptCredit = true;
            });

            if (jumpToNode) {
                S.view.jumpToId(node.id);
            }
        }
    }

    async importJson(nodeId: string, type: string) {
        const res = await S.rpcUtil.rpc<J.ImportJsonRequest, J.ImportJsonResponse>("importJson", {
            nodeId,
            type
        });
        if (res.code === C.RESPONSE_CODE_OK) {
            S.view.jumpToId(res.nodeId);
        }
    }

    async askQuestionAboutSubGraph(nodeId: string) {
        const dlg = new AskAboutSubgraphDlg(nodeId);
        await dlg.open();
    }

    async generateBookByAI(node: NodeInfo) {
        const dlg = new GenerateBookByAIDlg(node);
        await dlg.open();
    }

    async configureAgent(node: NodeInfo) {
        const dlg = new ConfigureAgentDlg(node);
        await dlg.open();
    }

    async saveClipboardToChildNode(parentId: string, msg: string) {
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

        if (!clipText && !blob) {
            S.util.flashMessage("Nothing saved clipboard is empty!", "Warning", true);
            return;
        }

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: parentId,
            aiRequest: false,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: clipText,
            typeLock: false,
            properties: null,
            shareToUserId: null,
            payloadType: null,
            aiMode: J.Constant.AI_MODE_CHAT,
            allowAiOverwrite: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);

        if (blob) {
            this.createSubNodeResponse(res, null);
        }
        else {
            if (msg) {
                if (clipText) {
                    msg += ":\n\n" + clipText;
                }
                S.util.flashMessage(msg, "Saved", true);
            }
        }
    }

    async splitNode(node: NodeInfo, splitType: string, delimiter: string) {
        node = node || S.nodeUtil.getHighlightedNode();

        if (!node) {
            S.util.showMessage("You didn't select a node to split.", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.SplitNodeRequest, J.SplitNodeResponse>("splitNode", {
            splitType,
            nodeId: node.id,
            delimiter
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        if (S.util.checkSuccess("Split content", res)) {
            S.view.refreshTree({
                nodeId: null,
                zeroOffset: false,
                highlightId: null,
                scrollToTop: false,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                jumpToRss: false
            });
            S.view.scrollToNode();
        }
    }

    _addBookmark = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            this.createNode(node, J.NodeType.BOOKMARK, true, null);
        }
    }

    async addLinkBookmark(content: any, audioUrl: string) {
        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: true,
            nodeId: null,
            aiRequest: false,
            newNodeName: "",
            typeName: J.NodeType.BOOKMARK,
            createAtTop: true,
            content,
            typeLock: true,
            payloadType: "linkBookmark",
            properties: audioUrl ? [{ name: J.NodeProp.AUDIO_URL, value: audioUrl }] : null,
            shareToUserId: null,
            aiMode: J.Constant.AI_MODE_CHAT,
            allowAiOverwrite: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        this.createSubNodeResponse(res, null);
    }

    // like==false means 'unlike'
    async likeNode(node: NodeInfo, like: boolean) {
        await S.rpcUtil.rpc<J.LikeNodeRequest, J.LikeNodeResponse>("likeNode", {
            id: node.id,
            like
        }, true);

        dispatch("likeNode", s => {
            node.likes = node.likes || [];

            if (like && !node.likes.find(u => u === s.userName)) {
                // add userName to likes
                node.likes.push(s.userName);
            }
            else {
                // remove userName from likes
                node.likes = node.likes.filter(u => u !== s.userName);
            }
        });
    }

    async addNode(nodeId: string, typeName: string, content: string, shareToUserId: string) {

        // auto-enable edit mode
        if (!getAs().userPrefs.editMode) {
            await this.setEditMode(true);
        }

        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: true,
            nodeId,
            aiRequest: false,
            newNodeName: "",
            typeName: typeName || J.NodeType.NONE,
            createAtTop: true,
            content,
            typeLock: false,
            properties: null,
            shareToUserId,
            payloadType: null,
            aiMode: J.Constant.AI_MODE_CHAT,
            allowAiOverwrite: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        this.createSubNodeResponse(res, null);
    }

    async createNode(node: NodeInfo, typeName: string,
        pendingEdit: boolean, content: string) {
        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit,
            nodeId: node ? node.id : null,
            aiRequest: false,
            newNodeName: "",
            typeName,
            createAtTop: true,
            content,
            typeLock: true,
            properties: null,
            payloadType: null,
            shareToUserId: null,
            aiMode: J.Constant.AI_MODE_CHAT,
            allowAiOverwrite: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);

        // auto-enable edit mode
        if (!getAs().userPrefs.editMode) {
            await this.setEditMode(true);
        }
        this.createSubNodeResponse(res, null);

        // this is low priority so do it asynchronously
        setTimeout(() => {
            S.props.addRecentType(typeName);
        }, 1000);
    }

    async addCalendarEntry(initDate: number) {
        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: getAs().fullScreenConfig.nodeId,
            aiRequest: false,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: null,
            typeLock: true,
            properties: [{ name: J.NodeProp.DATE, value: "" + initDate }],
            shareToUserId: null,
            payloadType: null,
            aiMode: J.Constant.AI_MODE_CHAT,
            allowAiOverwrite: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        this.createSubNodeResponse(res, null);
    }

    async linkNodes(sourceNodeId: string, targetNodeId: string, link: J.NodeLink, type: string) {
        if (targetNodeId === sourceNodeId) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.LinkNodesRequest, J.LinkNodesResponse>("linkNodes", {
            sourceNodeId,
            targetNodeId,
            name: link.name,
            embed: link.embed,
            type
        });

        if (S.util.checkSuccess("LinkNodes Response", res)) {
            S.view.refreshTree({
                nodeId: null,
                zeroOffset: false,
                highlightId: null,
                scrollToTop: false,
                allowScroll: false,
                setTab: false,
                forceRenderParent: false,
                jumpToRss: false
            });
        }
    }

    async moveNodeByDrop(targetNodeId: string, sourceNodeId: string, location: string) {
        /* if node being dropped on itself, then ignore */
        if (!sourceNodeId || targetNodeId === sourceNodeId) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.MoveNodesRequest, J.MoveNodesResponse>("moveNodes", {
            targetNodeId,
            nodeIds: [sourceNodeId],
            location,
            copyPaste: false
        });
        S.nodeUtil.applyNodeChanges(res?.nodeChanges);
        S.render.fadeInId = sourceNodeId;

        if (S.util.checkSuccess("Move nodes", res)) {
            dispatch("SetNodesToMove", s => {
                s.nodesToMove = null;
                s.cutCopyOp = null;
            });

            const ast = getAs();
            if (ast.activeTab === C.TAB_MAIN) {
                S.view.refreshTree({
                    nodeId: null,
                    zeroOffset: false,
                    highlightId: null,
                    scrollToTop: false,
                    allowScroll: false,
                    setTab: false,
                    forceRenderParent: false,
                    jumpToRss: false
                });
            }
            else if (ast.activeTab === C.TAB_DOCUMENT) {
                const data: TabBase<any> = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
                if (data) {
                    (data.inst as DocumentView<ResultSetInfo>).pageChange(null);
                }
            }
        }
    }

    _setHeadings = async () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            await S.rpcUtil.rpc<J.UpdateHeadingsRequest, J.UpdateHeadingsResponse>("updateHeadings", {
                nodeId: node.id
            });
            S.quanta.refresh();
        }
    }

    /*
     * Handles 'Sharing' button on a specific node, from button bar above node display in edit mode
     */
    async editNodeSharing(node: NodeInfo) {
        node = node || S.nodeUtil.getHighlightedNode();
        if (!node) {
            S.util.showMessage("No node is selected.", "Warning");
            return;
        }

        const sharingDlg = new SharingDlg();
        await sharingDlg.open();
    }

    /* Whenever we share an encrypted node to a another user, this is the final operation we run
   which generates a key to the data which is encrypted with the public key of the person
   (identified by principalNodeId) the node is shared to. Then publishes that key info into the DB,
   so that only the other person who this node is shared to can use their private key to decrypt the
   key to the data, to view the node.
   */
    async addCipherKeyToNode(node: NodeInfo, principalPublicKeyStr: string, principalNodeId: string) {
        if (principalNodeId === PrincipalName.PUBLIC || !S.crypto.avail) {
            console.warn("public node has encryption turned on. This is a bug.");
            return;
        }

        // get the asym-encrypted sym Key to this node (decryptable by owner of node only, which is us)
        const cipherKey = S.props.getPropStr(J.NodeProp.ENC_KEY, node);
        if (!cipherKey) {
            console.warn("No cipher key found on node.");
            return;
        }

        // get this broswer's private key from browser storage
        const privateKey: CryptoKey = await S.crypto.getPrivateEncKey();

        // so this is the decrypted symmetric key to the data (the unencrypted copy of the actual AES key to the data)
        const clearKey = await S.crypto.asymDecryptString(privateKey, cipherKey);
        if (!clearKey) {
            throw new Error("Unable to access encryption key.");
        }

        // first parse the key and build a usable key from principalPublicKey.
        const principalSymKeyJsonObj: JsonWebKey = JSON.parse(principalPublicKeyStr);
        const principalPublicKey = await S.crypto.importKey(principalSymKeyJsonObj, S.crypto.ASYM_IMPORT_ALGO, true, S.crypto.OP_ENC);

        // now re-encrypt this clearTextKey using the public key (of the user being shared to).
        const userCipherKey = await S.crypto.asymEncryptString(principalPublicKey, clearKey);

        /* Now post this encrypted key (decryptable only by principalNodeId's private key) up to the
        server which will then store this key alongside the ACL (access control list) for the
        sharing entry for this user */
        await S.rpcUtil.rpc<J.SetCipherKeyRequest, J.SetCipherKeyResponse>("setCipherKey", {
            nodeId: node.id,
            principalNodeId,
            cipherKey: userCipherKey
        });
    }

    updateNode(node: NodeInfo) {
        dispatch("UpdateNode", s => s.editNode = node);
    }

    helpNewUserEdit() {
        const ast = getAs();
        if (this.helpNewUserEditCalled) return;
        this.helpNewUserEditCalled = true;
        if (ast.userPrefs.editMode && ast.userPrefs.showMetaData) return;

        setTimeout(() => {
            this.setUserPreferenceVal(s => {
                S.nav.changeMenuExpansion(s, "expand", C.OPTIONS_MENU_TEXT);
                s.userPrefs.editMode = true;
                s.userPrefs.showMetaData = true;
            });
        }, 200);
    }

    /* WARNING: despite the name this only refreshes attachments and links */
    async refreshFromServer(node: NodeInfo) {
        const res = await S.rpcUtil.rpc<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: node.id,
            upLevel: false,
            siblingOffset: 0,
            forceRenderParent: false,
            offset: 0,
            goToLastPage: false,
            singleNode: true,
            jumpToRss: false
        });
        S.nodeUtil.processInboundNode(res.node);

        if (res.node) {
            node.attachments = res.node.attachments;
            node.links = res.node.links;
        }
    }

    public _endDelete = async () => {
        dispatch("DeleteComplete", s => {
            s.nodeClickedToDel = null;
            s.nodesToDel = null;
            s.selectedNodes.clear();
        });
    }

    public async immediateDeleteSelNodes(nodesToDel: string[] = null) {
        const ast = getAs();
        nodesToDel = nodesToDel || ast.nodesToDel;

        // if a delete isn't being done return
        if (!nodesToDel || nodesToDel.length === 0) {
            return;
        }

        let deletedPageNode: boolean = false;
        if (nodesToDel.find(id => id === ast.node?.id)) {
            deletedPageNode = true;
        }
        const jumpToParentOf = deletedPageNode && !S.util.fullscreenViewerActive() ? ast.node?.id : null;

        let res = await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
            nodeIds: nodesToDel,
            childrenOnly: false,
            bulkDelete: false,
            jumpToParentOf,
            force: false
        });

        // if we have a warning from that delete attempt, show it to the user and let them decide wehter to proceed
        // which is done by a second call with force=true
        if (res.warning) {
            const dlg = new ConfirmDlg(res.warning, "Confirm Delete");
            await dlg.open();
            if (dlg.yes) {
                res = await S.rpcUtil.rpc<J.DeleteNodesRequest, J.DeleteNodesResponse>("deleteNodes", {
                    nodeIds: nodesToDel,
                    childrenOnly: false,
                    bulkDelete: false,
                    jumpToParentOf,
                    force: true
                });
            }
            else {
                return;
            }
        }

        S.histUtil.removeNodesFromHistory(nodesToDel);
        this.removeNodesFromCalendarData(nodesToDel);

        /* Node: state.node can be null if we've never been to the tree view yet */
        if (ast.node && S.util.checkSuccess("Delete node", res)) {
            S.util.notifyNodeDeleted();
            this.recursiveDelete(nodesToDel, ast.node);
            this.afterDeleteCleanup(nodesToDel);

            if (S.util.fullscreenViewerActive()) {
                getAs().node.children = ast.node.children;
            }
            else if (res.jumpTargetId) {
                S.view.jumpToId(res.jumpTargetId);
            }
            else if (ast.activeTab === C.TAB_DOCUMENT) {
                const data: TabBase = S.tabUtil.getAppTabData(C.TAB_DOCUMENT);
                if (data) {
                    S.srch.showDocument(data.props.node.id, false, null);
                }
            }
            else if (ast.activeTab === C.TAB_MAIN && deletedPageNode) {
                S.nav._navToMyAccntRoot();
            }
            else if (ast.activeTab === C.TAB_MAIN && ast.node.children.length === 0) {
                S.view.jumpToId(ast.node.id);
            }
            else {
                getAs().node.children = ast.node.children;
            }
        }
    }

    recursiveDelete(nodesToDel: string[], node: NodeInfo) {
        if (node == null || !node.children) return;
        node.children = node.children.filter(child => !nodesToDel.find(id => id === child?.id));
        node.children.forEach(child => this.recursiveDelete(nodesToDel, child));
    }

    _replyToNode = (evt: Event) => {
        const ast = getAs();
        if (ast.isAnonUser) {
            S.util.showMessage("Login to create content and reply to nodes.", "Login!");
        }
        else {
            const nodeId = S.domUtil.getNodeIdFromDom(evt);
            if (!nodeId) return;
            S.edit.addNode(nodeId, J.NodeType.COMMENT, null, null);
        }
    }

    likeNodeClick = (evt: Event) => {
        const ast = getAs();
        if (ast.isAdminUser) {
            S.util.showMessage("Admin user can't do Likes.", "Admin");
            return;
        }

        if (ast.isAnonUser) {
            S.util.showMessage("Login to like and create content.", "Login!");
            return
        }

        const node = S.util.getNodeFromEvent(evt);
        if (!node) return;

        const youLiked = !!node.likes?.find(u => u === ast.userName);
        S.edit.likeNode(node, !youLiked);
    }

    _setLinkSource = () => {
        const node = S.nodeUtil.getHighlightedNode();
        dispatch("setLinkSourceNodeId", s => {
            if (node) {
                s.linkSource = node.id;
            }
        });
    }

    _linkNodesClick = () => {
        dispatch("setLinkSourceNodeId", s => {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                const sourceId = s.linkSource;

                if (!sourceId) {
                    S.util.showMessage("Please select a Subject Node.");
                    return;
                }

                if (sourceId === node.id) {
                    S.util.showMessage("Subject and Object nodes cannot be the same.");
                    return;
                }

                // create a run method because we're inside a dispatch and we can't await here
                const run = async () => {
                    const dlg = new AskNodeLinkNameDlg(null);
                    await dlg.open();
                    if (dlg.link) {
                        this.linkNodes(sourceId, node.id, dlg.link, "forward-link");
                    }
                };
                run();
            }
            s.linkSource = null;
        });
    };
}
