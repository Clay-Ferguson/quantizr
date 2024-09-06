import { asyncDispatch, dispatch, getAs, promiseDispatch } from "./AppContext";
import { Comp } from "./comp/base/Comp";
import { Div } from "./comp/core/Div";
import { Menu } from "./comp/Menu";
import { MenuItem } from "./comp/MenuItem";
import { MenuItemSeparator } from "./comp/MenuItemSeparator";
import { Constants as C } from "./Constants";
import { BlockedUsersDlg } from "./dlg/BlockedUsersDlg";
import { FriendsDlg } from "./dlg/FriendsDlg";
import { PickNodeTypeDlg } from "./dlg/PickNodeTypeDlg";
import { SearchAndReplaceDlg } from "./dlg/SearchAndReplaceDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SearchUsersDlg } from "./dlg/SearchUsersDlg";
import { SendFeedbackDlg } from "./dlg/SendFeedbackDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { TypeIntf } from "./intf/TypeIntf";
import * as J from "./JavaIntf";
import { PrincipalName } from "./JavaIntf";
import { S } from "./Singletons";
import { TTSTab } from "./tabs/data/TTSTab";

export class MenuPanel extends Div {
    static initialized: boolean = false;

    constructor() {
        super(null, {
            id: C.ID_MENU,
            role: "tablist",
            className: "menuPanel"
        });
        if (!MenuPanel.initialized) {
            // if anon user keep the page very clean and don't show this.
            asyncDispatch("autoExpandOptionsMenu", s => {
                s.expandedMenus.add(C.OPTIONS_MENU_TEXT);
            });
            MenuPanel.initialized = true;
        }
    }

    // leaving for reference how to open this.
    static editFriends = () => { new FriendsDlg("Following", null, true).open(); };

    static openBookmarksNode = () => {
        S.util.setUserPreferences(true);
        S.nav.openContentNode("~" + J.NodeType.BOOKMARK_LIST, false);
    };

    static continueEditing = () => {
        const ast = getAs();
        if (ast.editNode) {
            S.view.jumpToId(ast.editNode.id);
        }
    };

    // We pre-create all these functions so that the re-rendering of this component doesn't also create functions
    // which can be slow in JS.

    static showBlockedUsers = () => { new BlockedUsersDlg("Blocked").open(); }
    static toggleEditMode = () => { S.edit.setEditMode(!getAs().userPrefs.editMode); }
    static setAiWritingMode = () => S.edit.setAiMode(J.Constant.AI_MODE_WRITING);
    static setAiAgentMode = () => S.edit.setAiMode(J.Constant.AI_MODE_AGENT);
    static setAiChatMode = () => S.edit.setAiMode(J.Constant.AI_MODE_CHAT);
    static toggleInfoMode = () => { S.edit.setShowMetaData(!getAs().userPrefs.showMetaData); }
    static userProfile = () => { new UserProfileDlg(null).open(); }
    static openUserGuide = () => S.nav.openContentNode(":user-guide", false);
    static transferNode = () => { new TransferNodeDlg(J.TransferOp.TRANSFER).open(); };
    static acceptTransfer = () => { new TransferNodeDlg(J.TransferOp.ACCEPT).open(); };
    static rejectTransfer = () => { new TransferNodeDlg(J.TransferOp.REJECT).open(); };
    static reclaimTransfer = () => { new TransferNodeDlg(J.TransferOp.RECLAIM).open(); };
    static subgraphHash = () => { S.edit.subGraphHash(); };
    static searchAndReplace = () => { new SearchAndReplaceDlg().open(); };
    static splitNode = () => { new SplitNodeDlg(null).open(); }
    static joinNodes = () => { S.edit.joinNodes(false); }
    static joinNodesToParent = () => { S.edit.joinNodes(true); }
    static showPublicWritableShares = () => { S.srch.findShares(PrincipalName.PUBLIC, J.PrivilegeType.WRITE); }
    static showPublicReadonlyShares = () => { S.srch.findShares(PrincipalName.PUBLIC, J.PrivilegeType.READ); }
    static showAllShares = () => { S.srch.findShares(null, null); }
    static searchByContent = () => { new SearchContentDlg().open(); };
    static searchByName = () => { new SearchByNameDlg().open(); }
    static searchById = () => { new SearchByIDDlg().open(); };
    static findUsers = () => { new SearchUsersDlg().open(); };
    static showFollowers = () => { S.srch.showFollowers(0, null); };
    static timelineByCreated = () => S.srch.timelineAfterUserInput("ctm");
    static timelineByModified = () => S.srch.timelineAfterUserInput("mtm");
    static showCalendar = () => S.render.showCalendar(null);
    static calendarFutureDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
    static calendarPastDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "pastOnly", "Past calendar dates (Newest at the top)", 0, true);
    static calendarPastDueDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "pastDueOnly", "Past Due calendar dates (Newest at the top)", 0, true);
    static calendarAllDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "all", "All calendar dates (Latest/Future at the top)", 0, true);
    static calendarToday = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "toay", "Today's calendar dates", 0, true);
    // static toolsShowClipboard = () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
    static import = () => S.edit.openImportDlg();
    static listSubgraphByPriority = () => S.srch.listSubgraphByPriority();
    static export = () => S.edit.openExportDlg();
    static viewNodeGraph = () => S.render.showGraph(null, "");
    static sendFeedback = () => { new SendFeedbackDlg(null).open(); }
    static isEditMode = () => getAs().userPrefs.editMode;
    static isInfoMode = () => getAs().userPrefs.showMetaData;

    static importJson = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.importJson(node.id, null);
        }
    };

    static openDocumentView = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.nav.openDocumentView(null, node.id);
        }
    }

    static importToC = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.importJson(node.id, "toc");
        }
    };

    static openTtsTab = () => {
        // this ttsTabSelected var is a quick hack to make tab show up, but we really need common
        // forceSelectTab for thsi purpose (or maybe selectTab SHOULD naturally force things?
        // probably so)
        TTSTab.ttsTabSelected = true;
        S.tabUtil.selectTab(C.TAB_TTS);
    };

    static openAiAskDoc = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.askQuestionAboutSubGraph(node.id);
        }
    };

    static configureAgent = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.configureAgent(node);
        }
    };

    static generateBookByAI = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.edit.generateBookByAI(node);
        }
    };

    static showUrls = () => S.render.showNodeUrl(null);
    static threadHistory = () => {
        const node = S.nodeUtil.getHighlightedNode();
        if (node) {
            S.srch.showThread(node.id);
        }
    };
    static nodeStats = () => S.view.getNodeStats();
    static nodeSignatureVerify = () => S.view.getNodeSignatureVerify();
    static signAllSubGraph = () => S.view.signSubGraph(false);
    static signUnsignedSubGraph = () => S.view.signSubGraph(true);

    override preRender(): boolean | null {
        const ast = getAs();

        const hltNode = S.nodeUtil.getHighlightedNode();
        let hltType = null;
        if (hltNode) {
            const type: TypeIntf = S.plugin.getType(hltNode.type);
            if (type) {
                hltType = type.getTypeName();
            }
        }
        const selNodeIsMine = !!hltNode && (hltNode.owner === ast.userName || ast.userName === PrincipalName.ADMIN);
        const onMainTab: boolean = ast.activeTab == C.TAB_MAIN;
        const transferFromMe = !!hltNode && hltNode.transferFromId === ast.userProfile?.userNodeId;
        const transferring = !!hltNode && !!hltNode.transferFromId;

        const importFeatureEnabled = selNodeIsMine || (!!hltNode && ast.userProfile?.userNodeId === hltNode.id);
        const exportFeatureEnabled = selNodeIsMine || (!!hltNode && ast.userProfile?.userNodeId === hltNode.id);

        const orderByProp = S.props.getPropStr(J.NodeProp.ORDER_BY, hltNode);
        const allowNodeMove: boolean = !orderByProp && S.props.isWritableByMe(ast.node);
        const isPageRootNode = ast.node && hltNode && ast.node.id === hltNode.id;
        const canMoveUp = !isPageRootNode && !ast.isAnonUser && (allowNodeMove && hltNode && hltNode.logicalOrdinal > 0);
        const canMoveDown = !isPageRootNode && !ast.isAnonUser && (allowNodeMove && hltNode && !hltNode.lastChild);

        const children = [];

        const allowEditMode = !ast.isAnonUser;
        const fullScreenViewer = S.util.fullscreenViewerActive();

        children.push(new Menu(C.OPTIONS_MENU_TEXT, [
            ast.isAnonUser ? null : new MenuItem("Edit Mode", MenuPanel.toggleEditMode, allowEditMode && !fullScreenViewer, //
                MenuPanel.isEditMode, false, "ui-menu-options-editmode"),
            new MenuItem("Node Info", MenuPanel.toggleInfoMode, !fullScreenViewer, MenuPanel.isInfoMode)
        ], null, null, "ui-menu-options"));

        if (!ast.isAnonUser) {
            children.push(new Menu("View", [
                new MenuItem("Timeline: By Modified", MenuPanel.timelineByModified, onMainTab && !!hltNode, null, true),
                new MenuItem("Timeline: By Created", MenuPanel.timelineByCreated, onMainTab && !!hltNode, null, true),
                new MenuItemSeparator(), //
                new MenuItem("Thread History", MenuPanel.threadHistory, onMainTab && !!hltNode, null, true),
                new MenuItem("Document View", MenuPanel.openDocumentView, onMainTab && !!hltNode, null, true),
                new MenuItem("Node Graph", MenuPanel.viewNodeGraph, onMainTab && !!hltNode, null, true),
            ], null));

            children.push(new Menu("Search", [
                new MenuItem("By Content", MenuPanel.searchByContent, onMainTab && !!hltNode, null, true), //
                new MenuItem("By Node Name", MenuPanel.searchByName), //
                new MenuItem("By Node ID", MenuPanel.searchById), //

                // moved into editor dialog
                // new MenuItem("Edit Node Sharing", () => S.edit.editNodeSharing(state), //
                //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

                new MenuItemSeparator(), //

                new MenuItem("Shared Nodes", MenuPanel.showAllShares, !ast.isAnonUser && !!hltNode),
                new MenuItem("Public Read-only", MenuPanel.showPublicReadonlyShares, !ast.isAnonUser && !!hltNode),
                new MenuItem("Public Appendable", MenuPanel.showPublicWritableShares, !ast.isAnonUser && !!hltNode),
                new MenuItemSeparator(), //

                new MenuItem("Priority Listing", MenuPanel.listSubgraphByPriority, !ast.isAnonUser && !!hltNode), //
                new MenuItem("Search and Replace", MenuPanel.searchAndReplace, onMainTab && selNodeIsMine, null, true), //

                // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch },
                //    () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch })
            ], null));
        }

        const bookmarkItems = [];
        if (!ast.isAnonUser) {
            if (ast.bookmarks) {
                ast.bookmarks.forEach(bookmark => {
                    const nodeId = bookmark.id || bookmark.selfId;
                    const mi = new MenuItem(bookmark.name, () => S.view.bookmarkClick(bookmark), true, null);

                    if (!ast.mobileMode) {
                        S.domUtil.makeDropTarget(mi.attribs, nodeId);
                    }
                    bookmarkItems.push(mi);
                });
            }

            const hasBookmarks = bookmarkItems.length > 0;
            if (bookmarkItems.length > 0) {
                bookmarkItems.push(new MenuItemSeparator());
            }
            bookmarkItems.push(new MenuItem("Add Bookmark", S.edit.addBookmark, !ast.isAnonUser && !!hltNode, null, true));
            bookmarkItems.push(new MenuItem("Manage...", MenuPanel.openBookmarksNode, !ast.isAnonUser));

            if (hasBookmarks) {
                children.push(new Menu(C.BOOKMARKS_MENU_TEXT, bookmarkItems, null));
            }
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("People", [
                new MenuItem("Following", MenuPanel.editFriends),
                new MenuItem("Followers", MenuPanel.showFollowers),
                new MenuItem("Blocked", MenuPanel.showBlockedUsers),
                new MenuItemSeparator(),
                new MenuItem("Search", MenuPanel.findUsers)
            ], null));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("Edit", [
                ast.isAdminUser ? new MenuItem("Direct Edit JSON", S.edit.setUsingJson, onMainTab, null, true) : null,
                ast.editNode ? new MenuItem("Resume Editing...", MenuPanel.continueEditing) : null, //
                ast.editNode ? new MenuItemSeparator() : null, //

                new MenuItem("Clear Selections", S.nodeUtil.clearSelNodes, onMainTab && ast.selectedNodes.size > 0, null, true), //

                // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //
                new MenuItemSeparator(), //

                new MenuItem("Split Node", MenuPanel.splitNode, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Join Nodes", MenuPanel.joinNodes, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Append to Parent", MenuPanel.joinNodesToParent, onMainTab && selNodeIsMine, null, true), //

                new MenuItemSeparator(), //
                new MenuItem("Cut", S.edit._cutSelNodes, onMainTab && (ast.selectedNodes.size > 0 || !!hltNode), null, true), //
                new MenuItem("Copy", S.edit._copySelNodes, onMainTab && !ast.nodesToMove && (ast.selectedNodes.size > 0 || !!hltNode), null, true), //
                new MenuItem("Undo Copy/Cut", S.edit.undoCutSelNodes, onMainTab && !!ast.nodesToMove, null, true), //
            ], null));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("Move", [
                new MenuItem("Move Up", S.edit.moveUp, onMainTab && canMoveUp, null, true), //
                new MenuItem("Move Down", S.edit.moveDown, onMainTab && canMoveDown, null, true), //
                new MenuItemSeparator(), //
                new MenuItem("Move to Top", S.edit.moveNodeToTop, onMainTab && canMoveUp, null, true), //
                new MenuItem("Move to Bottom", S.edit.moveNodeToBottom, onMainTab && canMoveDown, null, true), //
            ], null));
        }

        const createMenuItems: Comp[] = [];
        const types = S.plugin.getAllTypes();
        const recentTypes = ast.userProfile && ast.userProfile.recentTypes ? ast.userProfile.recentTypes.split(",") : null;
        let typesAdded = false;

        if (!ast.isAnonUser) {
            types.forEach((type: TypeIntf, k: string) => {
                if (type.schemaOrg && !(recentTypes?.includes(k))) {
                    return;
                }
                typesAdded = true;
                if (ast.isAdminUser || type.getAllowUserSelect()) {
                    createMenuItems.push(new MenuItem(type.getName(), () => S.edit.createNode(hltNode, type.getTypeName(), true, null), //
                        onMainTab && !ast.isAnonUser && !!hltNode, null, true));
                }
            });
        }

        if (!ast.isAnonUser) {
            if (typesAdded) createMenuItems.push(new MenuItemSeparator());
            createMenuItems.push(new MenuItem("Choose Type...", async () => {
                await promiseDispatch("chooseType", s => s.showSchemaOrgProps = true);
                const dlg = new PickNodeTypeDlg(null);
                await dlg.open();
                if (dlg.chosenType) {
                    S.edit.createNode(hltNode, dlg.chosenType, true, null);
                }
            },
                onMainTab && !ast.isAnonUser && !!hltNode, null, true));

            children.push(new Menu("Create", createMenuItems, null, null, "ui-menu-create"));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("Calendar", [
                new MenuItem("Display", MenuPanel.showCalendar, onMainTab && !!hltNode, null, true),
                new MenuItemSeparator(), //
                new MenuItem("Past", MenuPanel.calendarPastDates, onMainTab && !!hltNode, null, true),
                new MenuItem("Past Due", MenuPanel.calendarPastDueDates, onMainTab && !!hltNode, null, true),
                new MenuItem("Future", MenuPanel.calendarFutureDates, onMainTab && !!hltNode, null, true),
                new MenuItem("Today", MenuPanel.calendarToday, onMainTab && !!hltNode, null, true),
                new MenuItem("All", MenuPanel.calendarAllDates, onMainTab && !!hltNode, null, true)
            ]));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("Tools", [
                new MenuItem("Set Headings", S.edit.setHeadings, onMainTab && selNodeIsMine, null, true), //
                !ast.isAnonUser && !ast.mobileMode && S.speech.ttsSupported() ? new MenuItem("Text-to-Speech Tab", MenuPanel.openTtsTab) : null,
                new MenuItem("Generate SHA256", MenuPanel.subgraphHash, onMainTab && selNodeIsMine, null, true),
                new MenuItemSeparator(), //

                // I decided with this on the toolbar we don't need it repliated here.
                // !state.isAnonUser ? new MenuItem("Save clipboard (under Notes node)", () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES)) : null, //
                new MenuItem("Show URLs", MenuPanel.showUrls, onMainTab && !!hltNode, null, true), //
                new MenuItem("Node Stats", MenuPanel.nodeStats, onMainTab, null, true), //
                new MenuItemSeparator(), //

                new MenuItem("Import", MenuPanel.import, onMainTab && importFeatureEnabled, null, true),
                new MenuItem("Export", MenuPanel.export, onMainTab && exportFeatureEnabled, null, true),
                new MenuItemSeparator(), //

                new MenuItem("Import JSON", MenuPanel.importJson, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Import ToC", MenuPanel.importToC, onMainTab && selNodeIsMine, null, true), //


                // Removing for now. Our PostIt node icon makes this easy enough.
                // new MenuItem("Save Clipboard", MenuPanel.toolsShowClipboard, !state.isAnonUser), //
            ], null));

            children.push(new Menu("Signature", [
                S.crypto.avail ? new MenuItem("Sign All", MenuPanel.signAllSubGraph, selNodeIsMine, null, true) : null, //
                S.crypto.avail ? new MenuItem("Sign Unsigned", MenuPanel.signUnsignedSubGraph, selNodeIsMine, null, true) : null, //
                new MenuItem("Verify", MenuPanel.nodeSignatureVerify, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Remove", S.view.removeSignatures, onMainTab && selNodeIsMine, null, true), //
            ], null));
        }

        if (!ast.isAnonUser && (S.quanta.config.useOpenAi || S.quanta.config.usePplxAi || S.quanta.config.useGeminiAi || S.quanta.config.useAnthAi)) {
            children.push(new Menu("AI", [
                new MenuItem("Ask About Subgraph", MenuPanel.openAiAskDoc, hltType == J.NodeType.NONE && onMainTab && selNodeIsMine, null, true),
                new MenuItem("Configure Agent", MenuPanel.configureAgent, hltType == J.NodeType.NONE && onMainTab && selNodeIsMine, null, true),
                new MenuItem("Generate Book", MenuPanel.generateBookByAI, hltType == J.NodeType.NONE && onMainTab && selNodeIsMine, null, true),
                new MenuItemSeparator(),
                ast.isAnonUser ? null : new MenuItem("Chat Mode", MenuPanel.setAiChatMode, allowEditMode && !fullScreenViewer, //
                    () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_CHAT, false, "ui-menu-options-editmode", "aiModeRadioGroup"),
                ast.isAnonUser ? null : new MenuItem("Writing Mode", MenuPanel.setAiWritingMode, allowEditMode && !fullScreenViewer, //
                    () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_WRITING, false, "ui-menu-options-editmode", "aiModeRadioGroup"),
                ast.isAnonUser || !S.quanta.config.aiAgentEnabled ? null : new MenuItem("Agent Mode", MenuPanel.setAiAgentMode, allowEditMode && !fullScreenViewer, //
                    () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_AGENT, false, "ui-menu-options-editmode", "aiModeRadioGroup"),
                new MenuItem("Settings", S.nav.showAISettings)
            ], null));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("RDF Triple", [
                new MenuItem("Set Subject (Source)", S.edit.setLinkSource, onMainTab && ast.userPrefs.editMode && selNodeIsMine, null, true), //
                new MenuItem("Create Triple (Target)", S.edit.linkNodesClick, onMainTab && ast.userPrefs.editMode && !!ast.linkSource, null, true), //
                new MenuItemSeparator(), //
                new MenuItem("Find Subjects", S.srch.findRdfSubjects, onMainTab, null, true) //
            ]));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("Transfer", [
                new MenuItem("Transfer", MenuPanel.transferNode, onMainTab && selNodeIsMine && !transferring, null, true), //
                new MenuItem("Accept", MenuPanel.acceptTransfer, onMainTab && selNodeIsMine && transferring, null, true), //
                new MenuItem("Reject", MenuPanel.rejectTransfer, onMainTab && selNodeIsMine && transferring, null, true), //
                new MenuItem("Reclaim", MenuPanel.reclaimTransfer, onMainTab && transferFromMe, null, true) //

                // todo-2: need a "Show Incomming" transfers menu option
            ], null));

            children.push(new Menu("Account", [
                new MenuItem("Profile", MenuPanel.userProfile),
                new MenuItem("Settings", S.nav.showUserSettings)
            ]));
        }

        if (!ast.mobileMode && S.tourUtils) {
            S.tourUtils.init();
            const tourItems = [];
            S.tourUtils.tours.forEach(tour => {
                tourItems.push(new MenuItem(tour.name, () => {
                    dispatch("SetTour", s => s.tour = tour);
                }, true, null));
            });
            if (tourItems.length > 0) {
                children.push(new Menu("Guided Tours", tourItems, null));
            }
        }

        children.push(new Menu("Help", [
            new MenuItem("User Guide", MenuPanel.openUserGuide), //
            new MenuItem("Main Portal Node", S.util.loadAnonPageHome), //
            new MenuItem("Contact Us", MenuPanel.sendFeedback), //
        ], null));

        this.children = children;
        return true;
    }

    appendMenuItemFromConfig = (cfgItem: any, items: Comp[]): void => {
        if (cfgItem.name === "separator") {
            items.push(new MenuItemSeparator());
        }
        else {
            const link: string = cfgItem.link;
            let func: () => void = null;

            if (link) {
                // allows ability to select a tab
                if (link.startsWith("tab:")) {
                    const tab = link.substring(4);

                    /* special case for feed tab */
                    if (tab === C.TAB_FEED && !getAs().isAnonUser) {
                        func = S.nav.messagesToFromMe;
                    }
                    else {
                        func = () => S.tabUtil.selectTab(tab);
                    }
                }
                // covers http and https
                else if (link.startsWith("http")) {
                    func = () => window.open(link);
                }
                // named nodes like ":myName"
                else {
                    func = () => S.nav.openContentNode(link, true);
                }
            }

            items.push(new MenuItem(cfgItem.name, func));
        }
    }
}
