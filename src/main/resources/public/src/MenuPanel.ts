import { asyncDispatch, getAs } from "./AppContext";
import { Comp } from "./comp/base/Comp";
import { Tag } from "./comp/core/Tag";
import { Menu } from "./comp/Menu";
import { MenuItem } from "./comp/MenuItem";
import { MenuItemSeparator } from "./comp/MenuItemSeparator";
import { Constants as C } from "./Constants";
import { BlockedUsersDlg } from "./dlg/BlockedUsersDlg";
import { FriendsDlg } from "./dlg/FriendsDlg";
import { ModifyHashtags } from "./dlg/ModifyHashtagsDlg";
import { PickNodeTypeDlg } from "./dlg/PickNodeTypeDlg";
import { SearchAndReplaceDlg } from "./dlg/SearchAndReplaceDlg";
import { SearchDlg } from "./dlg/SearchDlg";
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

export class MenuPanel extends Comp {
    static initialized: boolean = false;

    constructor() {
        super({
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
    static editFriends = () => { new FriendsDlg("Following", null, true, true).open(); };

    static continueEditing = () => {
        const ast = getAs();
        if (ast.editNode) {
            S.view.jumpToId(ast.editNode.id);
        }
    };

    // We pre-create all these functions so that the re-rendering of this component doesn't also create functions
    // which can be slow in JS.

    // move all these static methods into fat "_" methods in the appropriate singleton class for each one.
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
    static subgraphHash = () => { S.edit._subGraphHash(); };
    static searchAndReplace = () => { new SearchAndReplaceDlg().open(); };
    static modifyHashtags = () => { new ModifyHashtags().open(); };
    static splitNode = () => { new SplitNodeDlg(null).open(); }
    static showPublicWritableShares = () => { S.srch.findShares(PrincipalName.PUBLIC, J.PrivilegeType.WRITE); }
    static showPublicReadonlyShares = () => { S.srch.findShares(PrincipalName.PUBLIC, J.PrivilegeType.READ); }
    static showAllShares = () => { S.srch.findShares(null, null); }
    static findUsers = () => { new SearchUsersDlg().open(); };
    static showFollowers = () => { S.srch.showFollowers(0, null); };
    static timelineByCreatedRecursive = () => S.srch.timelineWithOptions("ctm", true);
    static timelineByCreatedNonRecursive = () => S.srch.timelineWithOptions("ctm", false);
    static timelineByModifiedRecursive = () => S.srch.timelineWithOptions("mtm", true);
    static timelineByModifiedNonRecursive = () => S.srch.timelineWithOptions("mtm", false);
    static showCalendar = () => S.render.showCalendar(null);
    static calendarFutureDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
    static calendarPastDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "pastOnly", "Past calendar dates (Newest at the top)", 0, true);
    static calendarPastDueDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "overdue", "Overdue calendar dates (Newest at the top)", 0, true);
    static calendarAllDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "all", "All calendar dates (Latest/Future at the top)", 0, true);
    static calendarToday = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, "toay", "Today's calendar dates", 0, true);
    // static toolsShowClipboard = () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
    static listSubgraphByPriority = () => S.srch.listSubgraphByPriority();
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
    static nodeStats = () => S.view.getNodeStats(false, false);
    static uniqueWords = () => S.view.getNodeStats(true, false);
    static uniqueTags = () => S.view.getNodeStats(false, true);

    override preRender(): boolean | null {
        const ast = getAs();

        const hltNode = S.nodeUtil.getHighlightedNode();
        // let hltType = null;
        // if (hltNode) {
        //     const type: TypeIntf = S.plugin.getType(hltNode.type);
        //     if (type) {
        //         hltType = type.getTypeName();
        //     }
        // }
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
        const allowEditMode = !ast.isAnonUser;
        const fullScreenViewer = S.util.fullscreenViewerActive();
        const children = [];

        const bookmarkItems = [];
        if (!ast.isAnonUser) {
            bookmarkItems.push(new MenuItem("Add", S.edit._addBookmark, !ast.isAnonUser && !!hltNode, null, true));
            if (ast.bookmarks) {
                if (ast.bookmarks.length > 0) {
                    bookmarkItems.push(new MenuItemSeparator());
                }

                ast.bookmarks.forEach(bookmark => {
                    const nodeId = bookmark.id || bookmark.selfId;
                    const floatRightComps = [
                        new Tag("i", {
                            className: "fa fa-trash fa-lg",
                            title: "Delete",
                            onClick: (event) => {
                                // cancel even because it will also trigger the parent click event
                                event.stopPropagation();
                                S.edit.deleteBookmark(bookmark.selfId, bookmark.name);
                            }
                        })
                    ];
                    const mi = new MenuItem(bookmark.name, () => S.view.bookmarkClick(bookmark), true, null, false, null, null, floatRightComps);
                    S.domUtil.makeDropTarget(mi.attribs, nodeId);
                    bookmarkItems.push(mi);
                });
            }

            if (bookmarkItems.length > 0) {
                children.push(new Menu(C.BOOKMARKS_MENU_TEXT, bookmarkItems, null));
            }
        }

        children.push(new Menu(C.OPTIONS_MENU_TEXT, [
            ast.isAnonUser ? null : new MenuItem("Edit Mode", MenuPanel.toggleEditMode, allowEditMode && !fullScreenViewer, //
                MenuPanel.isEditMode, false, "ui-menu-options-editmode"),
            new MenuItem("Node Info", MenuPanel.toggleInfoMode, !fullScreenViewer, MenuPanel.isInfoMode, false, "ui-menu-options-infomode")
        ], null, null, "ui-menu-options"));

        if (!ast.isAnonUser) {
            children.push(new Menu("View", [
                new Menu("Timeline", [
                    new Menu("By Modified", [
                        new MenuItem("Recursive", MenuPanel.timelineByModifiedRecursive, onMainTab && !!hltNode, null, true),
                        new MenuItem("Non-Recursive", MenuPanel.timelineByModifiedNonRecursive, onMainTab && !!hltNode, null, true),
                    ], null, null, null, true),
                    new Menu("By Created", [
                        new MenuItem("Recursive", MenuPanel.timelineByCreatedRecursive, onMainTab && !!hltNode, null, true),
                        new MenuItem("Non-Recursive", MenuPanel.timelineByCreatedNonRecursive, onMainTab && !!hltNode, null, true),
                    ], null, null, null, true)
                ], null, null, null, true),
                new Menu("Calendar", [
                    new MenuItem("Display", MenuPanel.showCalendar, onMainTab && !!hltNode, null, true),
                    new MenuItemSeparator(), //
                    new MenuItem("Past", MenuPanel.calendarPastDates, onMainTab && !!hltNode, null, true),
                    new MenuItem("Overdue", MenuPanel.calendarPastDueDates, onMainTab && !!hltNode, null, true),
                    new MenuItem("Future", MenuPanel.calendarFutureDates, onMainTab && !!hltNode, null, true),
                    new MenuItem("Today", MenuPanel.calendarToday, onMainTab && !!hltNode, null, true),
                    new MenuItem("All", MenuPanel.calendarAllDates, onMainTab && !!hltNode, null, true)
                ], null, null, null, true),
                new MenuItem("Thread", MenuPanel.threadHistory, onMainTab && !!hltNode, null, true),
                new MenuItem("Document", MenuPanel.openDocumentView, onMainTab && !!hltNode, null, true),
                new MenuItem("Graph", MenuPanel.viewNodeGraph, onMainTab && !!hltNode, null, true),
                new MenuItemSeparator(), //
                new Menu("My Shares", [
                    new MenuItem("All", MenuPanel.showAllShares, !ast.isAnonUser && !!hltNode),
                    new MenuItem("Read-only", MenuPanel.showPublicReadonlyShares, !ast.isAnonUser && !!hltNode),
                    new MenuItem("Appendable", MenuPanel.showPublicWritableShares, !ast.isAnonUser && !!hltNode),
                ], null, null, null, true),

                new MenuItem("Priority Listing", MenuPanel.listSubgraphByPriority, !ast.isAnonUser && !!hltNode), //
                new MenuItem("Unique Tags", MenuPanel.uniqueTags, onMainTab, null, true), //
                new MenuItem("Unique Words", MenuPanel.uniqueWords, onMainTab, null, true), //
            ], null));

            const searchDefItems = [];
            if (!ast.isAnonUser) {
                if (ast.searchDefs) {
                    ast.searchDefs.forEach(sd => {
                        const floatRightComps = [
                            new Tag("i", {
                                className: "fa fa-edit fa-lg mr-2",
                                title: "Open Search",
                                onClick: (event) => {
                                    // cancel even because it will also trigger the parent click event
                                    event.stopPropagation();
                                    new SearchDlg(null, sd).open();
                                }
                            }),
                            new Tag("i", {
                                className: "fa fa-trash fa-lg",
                                title: "Delete",
                                onClick: (event) => {
                                    // cancel even because it will also trigger the parent click event
                                    event.stopPropagation();
                                    S.srch.deleteSearchDef(sd.name);
                                }
                            })
                        ];
                        const mi = new MenuItem(sd.name, () => S.srch.runSearchDef(sd), true, null, false, null, null, floatRightComps);
                        if (searchDefItems.length == 0) {
                            searchDefItems.push(new MenuItemSeparator());
                        }
                        searchDefItems.push(mi);
                    });
                }
            }

            children.push(new Menu("Search", [
                new MenuItem("New Search", S.srch._openSearchDlg, onMainTab && !!hltNode, null, true), //
                ...searchDefItems,
                // moved into editor dialog
                // new MenuItem("Edit Node Sharing", () => S.edit.editNodeSharing(state), //
                //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

                // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch },
                //    () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch })
            ], null));
        }

        if (!ast.isAnonUser && S.quanta.config?.multiUserEnabled) {
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
                ast.editNode ? new MenuItem("Resume Editing...", MenuPanel.continueEditing) : null, //
                new Menu("Move", [
                    new MenuItem("Up", S.edit._moveUp, onMainTab && canMoveUp, null, true), //
                    new MenuItem("Down", S.edit._moveDown, onMainTab && canMoveDown, null, true), //
                    new MenuItemSeparator(), //
                    new MenuItem("To Top", S.edit._moveNodeToTop, onMainTab && canMoveUp, null, true), //
                    new MenuItem("To Bottom", S.edit._moveNodeToBottom, onMainTab && canMoveDown, null, true), //
                ], null, null, null, true),
                new MenuItem("Cut", S.edit._cutSelNodes, onMainTab && (ast.selectedNodes.size > 0 || !!hltNode), null, true), //
                new MenuItem("Copy", S.edit._copySelNodes, onMainTab && !ast.nodesToMove && (ast.selectedNodes.size > 0 || !!hltNode), null, true), //
                new MenuItem("Undo Copy/Cut", S.edit._undoCutSelNodes, onMainTab && !!ast.nodesToMove, null, true), //
                new MenuItemSeparator(), //

                // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

                ast.isAdminUser ? new MenuItem("Edit JSON", S.edit._setUsingJson, onMainTab, null, true) : null,
                new MenuItem("Hashtags", MenuPanel.modifyHashtags, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Replace", MenuPanel.searchAndReplace, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Split", MenuPanel.splitNode, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Join", S.edit._joinNodes, onMainTab && selNodeIsMine, null, true), //
                new MenuItem("Clear Selections", S.nodeUtil._clearSelNodes, onMainTab && ast.selectedNodes.size > 0, null, true), //
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
                if (type.getAllowUserSelect()) {
                    createMenuItems.push(new MenuItem(type.getName(), () => S.edit.createNode(hltNode, type.getTypeName(), true, null), //
                        onMainTab && !ast.isAnonUser && !!hltNode, null, true));
                }
            });
        }

        if (!ast.isAnonUser) {
            if (typesAdded) createMenuItems.push(new MenuItemSeparator());
            createMenuItems.push(new MenuItem("More...", async () => {
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
            children.push(new Menu("Tools", [
                new MenuItem("Set Headings", S.edit._setHeadings, onMainTab && selNodeIsMine, null, true), //
                !ast.isAnonUser && S.tts.ttsSupported() ? new MenuItem("Text-to-Speech Tab", MenuPanel.openTtsTab) : null,
                new MenuItem("Generate SHA256", MenuPanel.subgraphHash, onMainTab && selNodeIsMine, null, true),
                new MenuItemSeparator(), //

                // I decided with this on the toolbar we don't need it repliated here.
                // !state.isAnonUser ? new MenuItem("Save clipboard (under Notes node)", () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES)) : null, //
                new MenuItem("Show URLs", MenuPanel.showUrls, onMainTab && !!hltNode, null, true), //
                new MenuItem("Node Info", MenuPanel.nodeStats, onMainTab, null, true), //
                new MenuItemSeparator(), //

                new Menu("Import From", [
                    new MenuItem("Archive", S.edit._openImportDlg, onMainTab && importFeatureEnabled, null, true),
                    new MenuItem("JSON", MenuPanel.importJson, onMainTab && selNodeIsMine, null, true), //
                    new MenuItem("ToC", MenuPanel.importToC, onMainTab && selNodeIsMine, null, true), //
                ], null, null, null, true),
                new MenuItem("Export", S.edit._openExportDlg, onMainTab && exportFeatureEnabled, null, true),

                // Removing for now. Our PostIt node icon makes this easy enough.
                // new MenuItem("Save Clipboard", MenuPanel.toolsShowClipboard, !state.isAnonUser), //
            ], null));
        }

        if (!ast.isAnonUser && (S.quanta.config.useOpenAi || S.quanta.config.usePplxAi || S.quanta.config.useGeminiAi || S.quanta.config.useAnthAi)) {
            children.push(new Menu("AI", [
                new MenuItem("Configure AI", MenuPanel.configureAgent, onMainTab && selNodeIsMine, null, true),
                new MenuItem("Ask About Subgraph", MenuPanel.openAiAskDoc, onMainTab && selNodeIsMine, null, true),
                new MenuItem("Generate Book", MenuPanel.generateBookByAI, onMainTab && selNodeIsMine, null, true),
                new Menu("Mode", [
                    ast.isAnonUser ? null : new MenuItem("Chat", MenuPanel.setAiChatMode, allowEditMode && !fullScreenViewer, //
                        () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_CHAT, false, null, "aiModeRadioGroup"),
                    ast.isAnonUser ? null : new MenuItem("Writing", MenuPanel.setAiWritingMode, allowEditMode && !fullScreenViewer, //
                        () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_WRITING, false, null, "aiModeRadioGroup"),
                    ast.isAnonUser || !S.quanta.config.aiAgentEnabled ? null : new MenuItem("Agent", MenuPanel.setAiAgentMode, allowEditMode && !fullScreenViewer, //
                        () => getAs().userPrefs.aiMode == J.Constant.AI_MODE_AGENT, false, null, "aiModeRadioGroup")
                ], null, null, null, true)
            ], null));
        }

        if (!ast.isAnonUser) {
            children.push(new Menu("RDF", [
                new MenuItem("Set Subject (Source)", S.edit._setLinkSource, onMainTab && ast.userPrefs.editMode && selNodeIsMine, null, true), //
                new MenuItem("Create Triple (Target)", S.edit._linkNodesClick, onMainTab && ast.userPrefs.editMode && !!ast.linkSource, null, true), //
                new MenuItemSeparator(), //
                new MenuItem("Find Subjects", S.srch._findRdfSubjects, onMainTab, null, true) //
            ]));
        }

        if (!ast.isAnonUser && S.quanta.config?.multiUserEnabled) {
            children.push(new Menu("Transfer", [
                new MenuItem("Transfer", MenuPanel.transferNode, onMainTab && selNodeIsMine && !transferring, null, true), //
                new MenuItem("Accept", MenuPanel.acceptTransfer, onMainTab && selNodeIsMine && transferring, null, true), //
                new MenuItem("Reject", MenuPanel.rejectTransfer, onMainTab && selNodeIsMine && transferring, null, true), //
                new MenuItem("Reclaim", MenuPanel.reclaimTransfer, onMainTab && transferFromMe, null, true) //

                // todo-2: need a "Show Incomming" transfers menu option
            ], null));
        }

        children.push(new Menu("Account", [
            new MenuItem("Profile", MenuPanel.userProfile),
            new MenuItem("Settings", S.nav._showUserSettings),
            getAs().isAdminUser ? new MenuItem("Server Admin", () => S.tabUtil.selectTab(C.TAB_ADMIN)) : null
        ]));

        children.push(new Menu("Help", [
            new MenuItem("User Guide", MenuPanel.openUserGuide), //
            new MenuItem("Main Portal Node", S.util._loadAnonPageHome), //
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
                        func = S.nav._messagesToFromMe;
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
