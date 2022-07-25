import { useSelector } from "react-redux";
import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Div } from "./comp/core/Div";
import { Icon } from "./comp/core/Icon";
import { Menu } from "./comp/Menu";
import { MenuItem } from "./comp/MenuItem";
import { MenuItemSeparator } from "./comp/MenuItemSeparator";
import { Constants as C } from "./Constants";
import { ImportCryptoKeyDlg } from "./dlg/ImportCryptoKeyDlg";
import { ManageAccountDlg } from "./dlg/ManageAccountDlg";
import { ManageEncryptionKeysDlg } from "./dlg/ManageEncryptionKeysDlg";
import { ManageStorageDlg } from "./dlg/ManageStorageDlg";
import { MediaRecorderDlg } from "./dlg/MediaRecorderDlg";
import { SearchAndReplaceDlg } from "./dlg/SearchAndReplaceDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SearchUsersDlg } from "./dlg/SearchUsersDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { TabIntf } from "./intf/TabIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { S } from "./Singletons";

export class MenuPanel extends Div {
    constructor(state: AppState) {
        super(null, {
            id: "accordion",
            role: "tablist",
            className: (state.mobileMode ? "menuPanelMobile" : "menuPanel") + " accordion"
        });
    }

    // leaving for reference how to open this.
    // static openUserGuide = () => S.nav.openContentNode(":user-guide");
    static openNotesNode = () => S.nav.openContentNode("~" + J.NodeType.NOTES);

    static openFriendsNode = () => {
        S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST);
    };

    static openBookmarksNode = () => {
        let state = store.getState();
        S.util.setUserPreferences(state, true);
        S.nav.openContentNode("~" + J.NodeType.BOOKMARK_LIST);
    };

    static continueEditing = () => {
        let state = store.getState();
        if (state.editNode) {
            S.view.jumpToId(state.editNode.id);
        }
    };

    // We pre-create all these functions so that the re-rendering of this component doesn't also create functions
    // which can be slow in JS.

    // todo-1: Need to include in instance setup docs, the fact that these nodes need to be defined.
    static aboutQuanta = () => S.nav.openContentNode(":home");
    static openUserGuide = () => S.nav.openContentNode(":user-guide");
    static openFeatures = () => S.nav.openContentNode(":features");
    static openScreencasts = () => S.nav.openContentNode(":screencast");
    static openDemoContent = () => S.nav.openContentNode(":demo-data");
    static openBlockedUsersNode = () => S.nav.openContentNode("~" + J.NodeType.BLOCKED_USERS);
    static openRSSFeedsNode = () => S.nav.openContentNode("~" + J.NodeType.RSS_FEEDS);
    static openPostsNode = () => S.nav.openContentNode("~" + J.NodeType.POSTS);
    static openHomeNode = () => S.nav.openContentNode(":" + appState(null).userName + ":home");
    static openExportsNode = () => S.nav.openContentNode("~" + J.NodeType.EXPORTS);
    static transferNode = () => { new TransferNodeDlg(appState(null)).open(); };
    static searchAndReplace = () => { new SearchAndReplaceDlg(appState(null)).open(); };
    static splitNode = () => { new SplitNodeDlg(null, appState(null)).open(); }
    static joinNodes = () => { S.edit.joinNodes(); }
    static showPublicWritableShares = () => { S.srch.findShares(null, "public", J.PrivilegeType.WRITE); }
    static showPublicReadonlyShares = () => { S.srch.findShares(null, "public", J.PrivilegeType.READ); }
    static showAllShares = () => { S.srch.findShares(null, null, null); }
    static searchByContent = () => { new SearchContentDlg(appState(null)).open(); };
    static searchByName = () => { new SearchByNameDlg(appState(null)).open(); }
    static searchById = () => { new SearchByIDDlg(appState(null)).open(); };
    static findUsers = () => { new SearchUsersDlg(appState(null)).open(); };
    static showFollowers = () => { S.srch.showFollowers(0, null); };
    static timelineByCreated = () => S.srch.timeline(null, "ctm", appState(null), null, "Rev-chron by Create Time", 0, true);
    static timelineByModified = () => S.srch.timeline(null, "mtm", appState(null), null, "Rev-chron by Modify Time", 0, true);
    static timelineByCreatedNonRecursive = () => S.srch.timeline(null, "ctm", appState(null), null, "Rev-chron by Create Time (non-Recursive)", 0, false);
    static timelineByModifiedNonRecursive = () => S.srch.timeline(null, "mtm", appState(null), null, "Rev-chron by Modify Time (non-Recursive)", 0, false);
    static showCalendar = () => S.render.showCalendar(null, appState(null));
    static calendarFutureDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, appState(null), "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
    static calendarPastDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, appState(null), "pastOnly", "Past calendar dates (Newest at the top)", 0, true);
    static calendarAllDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, appState(null), "all", "All calendar dates", 0, true);
    // static toolsShowClipboard = () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
    // static toolsShowIpfsTab = () => S.edit.showIpfsTab();
    static import = () => S.edit.openImportDlg(appState(null));
    static listSubgraphByPriority = () => S.srch.listSubgraphByPriority(appState(null));
    static export = () => S.edit.openExportDlg(appState(null));
    static testMicrophone = () => { new MediaRecorderDlg(appState(null), false, false).open(); };
    static testWebCam = () => { new MediaRecorderDlg(appState(null), true, false).open(); };
    static mouseEffects = () => { S.util.toggleMouseEffect(); };
    static showUrls = () => S.render.showNodeUrl(null, appState(null));
    static showRawData = () => S.view.runServerCommand("getJson", null, "Node Data", "", appState(null));
    static showActPubJson = () => S.view.runServerCommand("getActPubJson", null, "ActivityPub JSON", "", appState(null));
    static nodeStats = () => S.view.getNodeStats(appState(null), false, false);

    static readJSONfromURL = () => {
        // This is an analytical tool, and doesn't need to be pretty so we just use the browser to ask for an input string.
        let url = window.prompt("ActivityPub Object URL: ");
        if (url) {
            S.view.runServerCommand("getActPubJson", url, "ActivityPub Object JSON", "", appState(null));
        }
    }

    // DO NOT DELETE
    // Experimental IPSM Console will be repurposed as a live log window of server events for the Admin user.
    static setIpsmActive = () => {
        dispatch("Action_enableIpsm", (s: AppState): AppState => {
            s.ipsmActive = true;
            setTimeout(() => {
                S.tabUtil.selectTab(C.TAB_IPSM);
            }, 250);
            return s;
        });

        let state = appState(null);
        state.userPreferences.enableIPSM = true;
        S.util.saveUserPreferences(state);
    };

    static showKeys = () => {
        let f = async () => {
            new ManageEncryptionKeysDlg(appState(null)).open();
        };
        f();
    };

    static generateKeys = () => { S.util.generateNewCryptoKeys(appState(null)); };
    static publishKeys = () => { S.encryption.initKeys(false, true, true); };
    static importKeys = () => { new ImportCryptoKeyDlg(appState(null)).open(); };
    static profile = () => { new UserProfileDlg(null, appState(null)).open(); };
    static accountSettings = () => { new ManageAccountDlg(appState(null)).open(); };
    static storageSpace = () => { new ManageStorageDlg(appState(null)).open(); };
    static toggleEditMode = () => S.edit.toggleEditMode(appState(null));
    static toggleMetaData = () => S.edit.toggleShowMetaData(appState(null));
    static toggleNsfw = () => S.edit.toggleNsfw(appState(null));
    static toggleParents = () => S.edit.toggleShowParents(appState(null));
    static toggleReplies = () => S.edit.toggleShowReplies(appState(null));
    static browserInfo = () => S.util.showBrowserInfo();
    static mobileToggle = () => S.util.switchBrowsingMode();

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        const hltNode: J.NodeInfo = S.nodeUtil.getHighlightedNode(state);
        const selNodeIsMine = !!hltNode && (hltNode.owner === state.userName || state.userName === "admin");

        const importFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);
        const exportFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);

        const orderByProp = S.props.getPropStr(J.NodeProp.ORDER_BY, hltNode);
        const allowNodeMove: boolean = !orderByProp && S.edit.isInsertAllowed(state.node, state);
        const isPageRootNode = state.node && hltNode && state.node.id === hltNode.id;
        const canMoveUp = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && hltNode.logicalOrdinal > 0);
        const canMoveDown = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && !hltNode.lastChild);

        const children = [];

        if (state.mobileMode) {
            children.push(new Menu("Tabs", this.getTabMenuItems(state)));
        }

        let bookmarkItems = [];
        if (!state.isAnonUser) {
            if (state.bookmarks) {
                state.bookmarks.forEach((bookmark: J.Bookmark): boolean => {
                    bookmarkItems.push(new MenuItem(bookmark.name, () => S.view.jumpToId(bookmark.id || bookmark.selfId), true, null));
                    return true;
                });
            }

            let hasBookmarks = bookmarkItems.length > 0;
            if (bookmarkItems.length > 0) {
                bookmarkItems.push(new MenuItemSeparator());
            }
            bookmarkItems.push(new MenuItem("Manage...", MenuPanel.openBookmarksNode, !state.isAnonUser));

            if (hasBookmarks) {
                children.push(new Menu(C.BOOKMARKS_MENU_TEXT, bookmarkItems, null, this.makeHelpIcon(":menu-bookmarks")));
            }
        }

        if (state.config?.menu?.help) {
            children.push(new Menu("Help", this.helpMenuItems(state)));
        }

        if (!state.isAnonUser) {
            children.push(new Menu("Quanta", [
                new MenuItem("My Account", S.nav.navHome, !state.isAnonUser),
                new MenuItem("My Home", MenuPanel.openHomeNode, !state.isAnonUser),
                new MenuItem("My Posts", MenuPanel.openPostsNode, !state.isAnonUser),
                new MenuItemSeparator(),
                new MenuItem("RSS Feeds", MenuPanel.openRSSFeedsNode, !state.isAnonUser),
                new MenuItem("Notes", MenuPanel.openNotesNode, !state.isAnonUser),
                new MenuItem("Exports", MenuPanel.openExportsNode, !state.isAnonUser)
            ], null, this.makeHelpIcon(":menu-tree")));
        }

        let messagesSuffix = state.newMessageCount > 0
            ? " (" + state.newMessageCount + " new)" : "";

        // These options will appear on the RHS for desktop mode
        if (state.mobileMode) {
            children.push(new Menu("Feed" + messagesSuffix, [
                new MenuItem("To/From Me", S.nav.messagesToFromMe, !state.isAnonUser),
                new MenuItem("To Me", S.nav.messagesToMe, !state.isAnonUser),
                new MenuItem("From Me", S.nav.messagesFromMe, !state.isAnonUser),
                new MenuItemSeparator(),
                new MenuItem("From Friends", S.nav.messagesFromFriends, !state.isAnonUser),
                // We need to make this a configurable option.
                // new MenuItem("From Local Users", S.nav.messagesLocal),
                new MenuItem("Federated", S.nav.messagesFediverse)
            ], null, this.makeHelpIcon(":menu-feed")));

            children.push(new Menu("Trending", [
                new MenuItem("Hashtags", S.nav.showTrendingHashtags),
                new MenuItem("Mentions", S.nav.showTrendingMentions),
                new MenuItem("Words", S.nav.showTrendingWords)
            ]));
        }

        children.push(new Menu("People", [
            new MenuItem("Friends", MenuPanel.openFriendsNode, !state.isAnonUser),
            new MenuItem("Followers", MenuPanel.showFollowers, !state.isAnonUser),
            new MenuItem("Blocked", MenuPanel.openBlockedUsersNode, !state.isAnonUser),
            new MenuItemSeparator(),
            new MenuItem("Find People", MenuPanel.findUsers, !state.isAnonUser) //
        ], null, this.makeHelpIcon(":menu-people")));

        children.push(new Menu("Edit", [
            state.editNode ? new MenuItem("Continue editing...", MenuPanel.continueEditing, !state.isAnonUser) : null, //
            new MenuItem("Clear Selections", S.nodeUtil.clearSelNodes, !state.isAnonUser && state.selectedNodes.size > 0), //

            // new MenuItem("Cut", S.edit.cutSelNodes, () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine }), //
            new MenuItem("Undo Cut", S.edit.undoCutSelNodes, !state.isAnonUser && !!state.nodesToMove), //

            // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

            // This feature CAN easily work for all users (although currently disabled on server for all but admin), but
            // we need some sort of "acceptance" feature for the recipient to take control, because for now they way this
            // works is you can take your own node and create the appearance that someone else authored it simply by
            // transferring the node to them, so we need some better process of acceptance.
            state.isAdminUser ? new MenuItem("Transfer Node", MenuPanel.transferNode, !state.isAnonUser && selNodeIsMine) : null, //

            new MenuItem("Update Headings", S.edit.updateHeadings, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Search and Replace", MenuPanel.searchAndReplace, !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Split Node", MenuPanel.splitNode, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Join Nodes", MenuPanel.joinNodes, !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Move to Top", S.edit.moveNodeToTop, canMoveUp), //
            new MenuItem("Move to Bottom", S.edit.moveNodeToBottom, canMoveDown), //

            new MenuItemSeparator(), //
            new MenuItem("Delete", S.edit.deleteSelNodes, !state.isAnonUser && selNodeIsMine) //

            // todo-2: disabled during mongo conversion
            // new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
            // new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
            //    () => { return state.isAdminUser && highlightNode != null }, //
            //    () => { return state.isAdminUser }, //
            //    true
            // ), //
        ], null, this.makeHelpIcon(":menu-edit")));

        let createMenuItems = [];
        let typeHandlers = S.plugin.getAllTypeHandlers();
        typeHandlers.forEach((typeHandler: TypeHandlerIntf, k: string): boolean => {
            if (state.isAdminUser || typeHandler.getAllowUserSelect()) {
                createMenuItems.push(new MenuItem(typeHandler.getName(), () => S.edit.createNode(hltNode, typeHandler.getTypeName(), true, true, null, null, state), //
                    !state.isAnonUser && !!hltNode));
            }
            return true;
        });

        children.push(new Menu("Create", createMenuItems, null, this.makeHelpIcon(":menu-create")));

        children.push(new Menu("Search", [
            new MenuItem("By Content", MenuPanel.searchByContent, !state.isAnonUser && !!hltNode), //
            new MenuItem("By Node Name", MenuPanel.searchByName, !state.isAnonUser), //
            new MenuItem("By Node ID", MenuPanel.searchById, !state.isAnonUser), //

            // moved into editor dialog
            // new MenuItem("Edit Node Sharing", () => S.edit.editNodeSharing(state), //
            //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Shared Nodes", MenuPanel.showAllShares, //
                !state.isAnonUser && !!hltNode),

            new MenuItem("Public Read-only", MenuPanel.showPublicReadonlyShares, //
                !state.isAnonUser && !!hltNode),

            new MenuItem("Public Appendable", MenuPanel.showPublicWritableShares, //
                !state.isAnonUser && !!hltNode),

            new MenuItemSeparator(), //

            new MenuItem("Priority Listing", MenuPanel.listSubgraphByPriority, //
                !state.isAnonUser && !!hltNode)

            // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch },
            //    () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch })
        ], null, this.makeHelpIcon(":menu-search")));

        children.push(new Menu("Timeline", [
            // todo-1: need to see if this is easy to turn on for non-logged in users.
            new MenuItem("Live Rev-Chron (Chat Room)", () => S.nav.messagesNodeFeed(state), !state.isAnonUser && hltNode?.id != null),
            new MenuItemSeparator(), //
            new MenuItem("Created", MenuPanel.timelineByCreated, !state.isAnonUser && !!hltNode), //
            new MenuItem("Modified", MenuPanel.timelineByModified, !state.isAnonUser && !!hltNode), //
            new MenuItemSeparator(), //
            new MenuItem("Created (non-Recursive)", MenuPanel.timelineByCreatedNonRecursive, !state.isAnonUser && !!hltNode), //
            new MenuItem("Modified (non-Recursive)", MenuPanel.timelineByModifiedNonRecursive, !state.isAnonUser && !!hltNode) //
        ], null, this.makeHelpIcon(":menu-timeline")));

        children.push(new Menu("Calendar", [
            new MenuItem("Display", MenuPanel.showCalendar, !state.isAnonUser && !!hltNode),
            new MenuItemSeparator(), //
            new MenuItem("Future", MenuPanel.calendarFutureDates, !state.isAnonUser && !!hltNode), //
            new MenuItem("Past", MenuPanel.calendarPastDates, !state.isAnonUser && !!hltNode), //
            new MenuItem("All", MenuPanel.calendarAllDates, !state.isAnonUser && !!hltNode) //
        ]));

        children.push(new Menu("Tools", [
            // new MenuItem("IPFS Explorer", MenuPanel.toolsShowIpfsTab), //

            // for now, we don't need the 'show properties' and it may never be needed again
            // new MenuItem("Toggle Properties", S.props.propsToggle, () => { return propsToggle }, () => { return !state.isAnonUser }), //

            new MenuItem("Import", MenuPanel.import, importFeatureEnabled),
            new MenuItem("Export", MenuPanel.export, exportFeatureEnabled),
            new MenuItemSeparator(), //

            new MenuItem("Test Microphone", MenuPanel.testMicrophone, !state.isAnonUser), //
            new MenuItem("Test Web Cam", MenuPanel.testWebCam, !state.isAnonUser), //

            new MenuItemSeparator(), //
            /* The mouse effect shows a grapical animation for each mouse click but I decided I don't like the fact
             that I have to impose an intentional performance lag to let the animation show up, so in order to have the
             absolute fastest snappiest response of the app, I'm just not using this mouseEffect for now but let's leave
             the code in place for future reference. */
            new MenuItem("Mouse Effects", MenuPanel.mouseEffects, !state.isAnonUser && !state.mobileMode, () => state.mouseEffect),

            new MenuItem("My GEO Location", S.nav.geoLocation) //

            // Removing for now. Our PostIt node icon makes this easy enough.
            // new MenuItem("Save Clipboard", MenuPanel.toolsShowClipboard, !state.isAnonUser), //

            // DO NOT DELETE
            // new MenuItem("Open IPSM Console", MenuPanel.setIpsmActive, !state.isAnonUser) //
        ], null, this.makeHelpIcon(":menu-tools")));

        children.push(new Menu("Node Info", [
            // I decided with this on the toolbar we don't need it repliated here.
            // !state.isAnonUser ? new MenuItem("Save clipboard (under Notes node)", () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES)) : null, //

            new MenuItem("Show URLs", MenuPanel.showUrls, !!hltNode), //
            new MenuItem("Show Raw Data", MenuPanel.showRawData, !state.isAnonUser && selNodeIsMine), //
            state.isAdminUser ? new MenuItem("Show ActivityPub JSON", MenuPanel.showActPubJson) : null, //
            new MenuItemSeparator(), //

            // Warning: this can put heavy load on server. Maybe make this kinda thing a "paid" feature?
            new MenuItem("Node Stats", MenuPanel.nodeStats, !state.isAnonUser && selNodeIsMine) //

            // This menu item works, but will have little value to users, because the only difference between this and 'Node Stats', is that
            // the 'trending' stats is defined as the 'Node Stats' for the most recent 500 results in the query. I had a need for this early on
            // because this is how the Feed View (Fediverse) stats is done, using arbitrarily chosen number 500 most recent posts as the universe
            // of data to pick the statistics from, but this arbitrary number 500 just won't be helpful on any sub-graph for any ordinary users (yet)
            // because you'd need a document with many thousands of nodes before the "top 500" will have any real significance as a 'trending' definition.
            // new MenuItem("Trending Stats", () => S.view.getNodeStats(state, true, false), //
            //     !state.isAnonUser /* state.isAdminUser */) //
        ], null, this.makeHelpIcon(":menu-node-info")));

        children.push(new Menu("Settings", [
            new MenuItem("Edit", MenuPanel.toggleEditMode, !state.isAnonUser, () => state.userPreferences.editMode), //
            new MenuItem("Info/Metadata", MenuPanel.toggleMetaData, true, () => state.userPreferences.showMetaData), //
            new MenuItem("Show Sensitive Content", MenuPanel.toggleNsfw, true, () => state.userPreferences.nsfw), //
            new MenuItem("Show Parent", MenuPanel.toggleParents, true, () => state.userPreferences.showParents), //
            new MenuItem("Show Replies", MenuPanel.toggleReplies, true, () => state.userPreferences.showReplies), //

            // For now there is only ONE button on the Perferences dialog that is accessible as a toolbar button already, so
            // until we have at least one more preference the preferences dialog is not needed.
            // new MenuItem("Preferences", () => S.edit.editPreferences(state), !state.isAnonUser), // "fa-gear"

            new MenuItemSeparator(), //

            new MenuItem("Browser Info", MenuPanel.browserInfo), //
            new MenuItem(state.mobileMode ? "Desktop Browser" : "Moble Browser", MenuPanel.mobileToggle), //

            new MenuItem("Profile", MenuPanel.profile, !state.isAnonUser), //
            new MenuItem("Account Settings", MenuPanel.accountSettings, !state.isAnonUser), //
            new MenuItem("Storage Space", MenuPanel.storageSpace, !state.isAnonUser), //
            !state.isAnonUser ? new MenuItem("Logout", S.nav.logout, !state.isAnonUser) : null, //
            state.isAnonUser ? new MenuItem("Signup", S.nav.signup, state.isAnonUser) : null //

            // menuItem("Full Repository Export", "fullRepositoryExport", "
            // S.edit.fullRepositoryExport();") + //
        ]));

        children.push(new Menu("Encrypt", [
            new MenuItem("Show Keys", MenuPanel.showKeys, !state.isAnonUser), //
            new MenuItem("Generate Keys", MenuPanel.generateKeys, !state.isAnonUser), //
            new MenuItem("Publish Keys", MenuPanel.publishKeys, !state.isAnonUser), //
            new MenuItem("Import Keys", MenuPanel.importKeys, !state.isAnonUser) //
        ], null, this.makeHelpIcon(":menu-encrypt")));

        // //need to make export safe for end users to use (recarding file sizes)
        // if (state.isAdminUser) {
        //     children.push(new Menu("Admin Tools", [
        //         //todo-2: disabled during mongo conversion
        //         //new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
        //         //new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
        //         //    () => { return state.isAdminUser && highlightNode != null }, //
        //         //    () => { return state.isAdminUser }, //
        //         //    true
        //         //), //
        //     ]));
        // }

        // WORK IN PROGRESS (do not delete)
        // let fileSystemMenuItems = //
        //     menuItem("Reindex", "fileSysReindexButton", "systemfolder.reindex();") + //
        //     menuItem("Search", "fileSysSearchButton", "systemfolder.search();"); //
        //     //menuItem("Browse", "fileSysBrowseButton", "systemfolder.browse();");
        // let fileSystemMenu = makeTopLevelMenu("FileSys", fileSystemMenuItems);

        /* This was experimental, and does work perfectly well (based on a small aount of testing done).
          These menu items can save a node subgraph to IPFS files (MFS) and then restore those nodes back
          from that tree branch. But the feature is not currently needed or enabled.
          */
        // eslint-disable-next-line no-constant-condition
        if (state.isAdminUser) {
            // DO NOT DELETE: Work in Progress....
            // children.push(new Menu("IPFS", [
            //     new MenuItem("Sync: To IPFS", () => S.nodeUtil.publishNodeToIpfs(hltNode), //
            //         state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)), //
            //     new MenuItem("Sync: From IPFS", () => S.nodeUtil.loadNodeFromIpfs(hltNode), //
            //         state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)) //
            // ]));
        }

        if (state.isAdminUser) {
            children.push(new Menu("Admin - Utils", [

                // new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                new MenuItem("Server Info", () => S.view.runServerCommand("getServerInfo", null, "Info View", null, state)), //
                new MenuItem("Toggle Daemons", () => S.view.runServerCommand("toggleDaemons", null, "Toggle Daemons", null, state)), //
                new MenuItem("View Session Activity", () => S.view.runServerCommand("getSessionActivity", null, "Session Activity", null, state)), //
                new MenuItem("Send Restart Warning", () => S.view.runServerCommand("sendAdminNote", null, "Admin Note", null, state)), //
                new MenuItem("Performance Report", () => window.open(S.util.getHostAndPort() + "/performance-report", "_blank")), //
                new MenuItem("Refresh RSS Cache", () => S.view.runServerCommand("refreshRssCache", null, "Refresh RSS Cache", null, state)), //
                new MenuItem("Insert Book: War and Peace", () => S.edit.insertBookWarAndPeace(state))
            ]));

            children.push(new Menu("Admin - DB", [
                new MenuItem("Validate", () => S.view.runServerCommand("validateDb", null, "Validate DB Response", null, state)), //
                new MenuItem("Compact DB & Cleanup Pins", () => S.view.runServerCommand("compactDb", null, "Compact DB Response", null, state)), //
                new MenuItem("Run DB Conversion", () => S.view.runServerCommand("runConversion", null, "Run DB Conversion", null, state)), //
                new MenuItem("Rebuild Indexes", () => S.view.runServerCommand("rebuildIndexes", null, "Rebuild Indexes Response", null, state)), //
                new MenuItem("Lucene: Refresh", () => S.view.runServerCommand("refreshLuceneIndex", null, null, null, state)),
                new MenuItem("Delete Node (w/ Orphans)", () => S.view.runServerCommand("deleteLeavingOrphans", null, "Delete node leaving orphans", null, state)) //
            ]));

            children.push(new Menu("Admin - ActivityPub", [
                new MenuItem("Fediverse Users", () => window.open(S.util.getHostAndPort() + "/fediverse-users", "_blank")), //
                new MenuItem("Get JSON from URL", MenuPanel.readJSONfromURL), //
                new MenuItem("Refresh Fediverse", () => S.view.runServerCommand("refreshFediverseUsers", null, "Refresh Fediverse Users", null, state)), //
                new MenuItem("Refresh AP Accts", () => S.view.runServerCommand("refreshAPAccounts", null, "Refresh AP Accounts", null, state)), //
                new MenuItem("ActPub Maintenance", () => S.view.runServerCommand("actPubMaintenance", null, "ActPub Maintenance Response", null, state)), //
                new MenuItem("Crawl Fediverse", () => S.view.runServerCommand("crawlUsers", null, "ActPub Crawl Response", null, state))
            ]));

            children.push(new Menu("Admin - Test", [
                new MenuItem("IPFS PubSub", () => S.view.runServerCommand("ipfsPubSubTest", null, "PubSub Test", null, state)), //
                new MenuItem("Send Email", () => S.util.sendTestEmail()),
                new MenuItem("Server Log Text", () => S.util.sendLogText()),
                new MenuItem("Notification Display", () => S.util.showSystemNotification("Test Title", "This is a test message")),
                new MenuItem("Encryption", async () => {
                    await S.encryption.test();
                    S.util.showMessage("Encryption Test Complete. Check browser console for output.", "Note", true);
                }),
                new MenuItem("Text to Speech", async () => {
                    const tts = window.speechSynthesis;
                    // let voices = tts.getVoices();
                    // for (let i = 0; i < voices.length; i++) {
                    //     let voice = voices[i];
                    //     // Google UK English Female (en-GB)
                    //     console.log("Voice: " + voice.name + " (" + voice.lang + ") " + (voice.default ? "<-- Default" : ""));
                    // }

                    /* WARNING: speechSynthesis seems to crash very often and leave hung processes, eating up CPU, at least
                    on my Ubuntu 18.04, machine, so for now any TTS development is on hold. */
                    let sayThis = new SpeechSynthesisUtterance("Wow. Browsers now support Text to Speech driven by JavaScript");
                    tts.speak(sayThis);
                })
            ]));
        }

        this.setChildren(children);
    }

    makeHelpIcon = (nodeName: string): Icon => {
        return new Icon({
            className: "fa fa-question-circle fa-lg float-end menuIcon",
            title: "Display Help Information",
            onClick: (event: any) => {
                event.stopPropagation();
                event.preventDefault();
                // S.view.jumpToId(bookmark.selfId);
                S.nav.openContentNode(nodeName);
            }
        });
    }

    // These are defined externally in config-text.yaml
    helpMenuItems = (state: AppState): Div[] => {
        let items: Div[] = [];
        if (state.config?.menu?.help) {
            for (let menuItem of state.config.menu.help) {
                if (menuItem.name === "separator") {
                    items.push(new MenuItemSeparator());
                }
                else {
                    let link: string = menuItem.link;
                    let func: Function = null;

                    if (link) {
                        // allows ability to select a tab
                        if (link.startsWith("tab:")) {
                            let tab = link.substring(4);

                            /* special case for feed tab */
                            if (tab === C.TAB_FEED) {
                                func = S.nav.messagesFediverse;
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
                            func = () => S.nav.openContentNode(link);
                        }
                    }

                    items.push(new MenuItem(menuItem.name, func));
                }
            }
        }
        return items;
    }

    getTabMenuItems = (state: AppState): MenuItem[] => {
        let items: MenuItem[] = [];
        for (let tab of state.tabData) {
            if (tab.isVisible(state)) {
                items.push(this.getTabMenuItem(state, tab));
            }
        }
        return items;
    }

    getTabMenuItem(state: AppState, data: TabIntf): MenuItem {
        return new MenuItem(data.name, (event) => {
            S.tabUtil.selectTab(data.id);
        }, true, () => state.activeTab === data.id);
    }
}
