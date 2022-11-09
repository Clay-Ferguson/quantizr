import { getAppState, promiseDispatch, useAppState } from "./AppContext";
import { AppState } from "./AppState";
import { CompIntf } from "./comp/base/CompIntf";
import { Div } from "./comp/core/Div";
import { Tag } from "./comp/core/Tag";
import { Menu } from "./comp/Menu";
import { MenuItem } from "./comp/MenuItem";
import { MenuItemSeparator } from "./comp/MenuItemSeparator";
import { Constants as C } from "./Constants";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { ManageCryptoKeysDlg } from "./dlg/ManageCryptoKeysDlg";
import { ManageStorageDlg } from "./dlg/ManageStorageDlg";
import { MediaRecorderDlg } from "./dlg/MediaRecorderDlg";
import { MultiFollowDlg } from "./dlg/MultiFollowDlg";
import { SearchAndReplaceDlg } from "./dlg/SearchAndReplaceDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SearchUsersDlg } from "./dlg/SearchUsersDlg";
import { SignupDlg } from "./dlg/SignupDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { MenuPanelState } from "./Interfaces";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";

declare const g_brandingAppName: string;

export class MenuPanel extends Div {
    static activeMenu: Set<string> = new Set<string>();
    static inst: MenuPanel;

    constructor(state: AppState) {
        super(null, {
            id: C.ID_MENU,
            role: "tablist",
            className: (state.mobileMode ? "menuPanelMobile" : "menuPanel") + " accordion"
        });
        MenuPanel.inst = this;
        this.mergeState<MenuPanelState>({ lastAction: null, lastClicked: null, expanded: MenuPanel.activeMenu });
    }

    // leaving for reference how to open this.
    // static openUserGuide = () => S.nav.openContentNode(":user-guide");
    static openNotesNode = () => S.nav.openContentNode("~" + J.NodeType.NOTES);

    static openFriendsNode = () => {
        S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST);
    };

    static openBookmarksNode = () => {
        const state = getAppState();
        S.util.setUserPreferences(state, true);
        S.nav.openContentNode("~" + J.NodeType.BOOKMARK_LIST);
    };

    static continueEditing = () => {
        const state = getAppState();
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
    static openHomeNode = () => S.nav.openContentNode(":" + getAppState(null).userName + ":home");
    static openExportsNode = () => S.nav.openContentNode("~" + J.NodeType.EXPORTS);
    static transferNode = () => { new TransferNodeDlg("transfer").open(); };
    static acceptTransfer = () => { new TransferNodeDlg("accept").open(); };
    static rejectTransfer = () => { new TransferNodeDlg("reject").open(); };
    static reclaimTransfer = () => { new TransferNodeDlg("reclaim").open(); };
    static subgraphHash = () => { S.edit.subGraphHash(); };
    static searchAndReplace = () => { new SearchAndReplaceDlg().open(); };
    static splitNode = () => { new SplitNodeDlg(null).open(); }
    static joinNodes = () => { S.edit.joinNodes(); }
    static showPublicWritableShares = () => { S.srch.findShares(null, "public", J.PrivilegeType.WRITE); }
    static showPublicReadonlyShares = () => { S.srch.findShares(null, "public", J.PrivilegeType.READ); }
    static showAllShares = () => { S.srch.findShares(null, null, null); }
    static searchByContent = () => { new SearchContentDlg().open(); };
    static searchByName = () => { new SearchByNameDlg().open(); }
    static searchById = () => { new SearchByIDDlg().open(); };
    static findUsers = () => { new SearchUsersDlg().open(); };
    static multiFollow = () => { new MultiFollowDlg().open(); };
    static createUser = () => { new SignupDlg(true).open(); };
    static showFollowers = () => { S.srch.showFollowers(0, null); };
    static timelineByCreated = () => S.srch.timeline(null, "ctm", getAppState(null), null, "Rev-chron by Create Time", 0, true);
    static timelineByModified = () => S.srch.timeline(null, "mtm", getAppState(null), null, "Rev-chron by Modify Time", 0, true);
    static timelineByCreatedNonRecursive = () => S.srch.timeline(null, "ctm", getAppState(null), null, "Rev-chron by Create Time (top level)", 0, false);
    static timelineByModifiedNonRecursive = () => S.srch.timeline(null, "mtm", getAppState(null), null, "Rev-chron by Modify Time (top level)", 0, false);
    static showCalendar = () => S.render.showCalendar(null, getAppState(null));
    static calendarFutureDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, getAppState(null), "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
    static calendarPastDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, getAppState(null), "pastOnly", "Past calendar dates (Newest at the top)", 0, true);
    static calendarAllDates = () => S.srch.timeline(null, J.NodeProp.DATE_FULL, getAppState(null), "all", "All calendar dates", 0, true);
    // static toolsShowClipboard = () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
    // static toolsShowIpfsTab = () => S.edit.showIpfsTab();
    static import = () => S.edit.openImportDlg(getAppState(null));
    static listSubgraphByPriority = () => S.srch.listSubgraphByPriority(getAppState(null));
    static export = () => S.edit.openExportDlg(getAppState(null));
    static testMicrophone = () => { new MediaRecorderDlg(false, false).open(); };
    static testWebCam = () => { new MediaRecorderDlg(true, false).open(); };
    static mouseEffects = () => { S.domUtil.toggleMouseEffect(); };
    static showUrls = () => S.render.showNodeUrl(null, getAppState(null));
    static showRawData = () => S.view.runServerCommand("getJson", null, "Node Data", "", getAppState(null));
    static showActPubJson = () => S.view.runServerCommand("getActPubJson", null, "ActivityPub JSON", "", getAppState(null));
    static nodeStats = () => S.view.getNodeStats(getAppState(null), false, false);
    static nodeSignatureVerify = () => S.view.getNodeSignatureVerify(getAppState(null));
    static signSubGraph = () => S.view.signSubGraph(getAppState(null));

    static readJSONfromURL = () => {
        // This is an analytical tool, and doesn't need to be pretty so we just use the browser to ask for an input string.
        const url = window.prompt("ActivityPub Object URL: ");
        if (url) {
            S.view.runServerCommand("getActPubJson", url, "ActivityPub Object JSON", "", getAppState(null));
        }
    }

    // DO NOT DELETE
    // Experimental IPSM Console will be repurposed as a live log window of server events for the Admin user.
    static setIpsmActive = async () => {

        await promiseDispatch("enableIpsm", s => {
            s.ipsmActive = true;
            setTimeout(() => {
                // S.tabUtil.selectTab(C.TAB_IPSM);
            }, 250);
            return s;
        });

        const state = getAppState(null);
        state.userPrefs.enableIPSM = true;
        S.util.saveUserPreferences(state);
    };

    static showKeys = () => { new ManageCryptoKeysDlg().open(); };
    static changePassword = () => { new ChangePasswordDlg(null).open(); };
    static bulkDelete = () => { S.edit.bulkDelete(); };
    static closeAccount = () => { S.user.closeAccount(); };
    static profile = () => { new UserProfileDlg(null).open(); };
    static storageSpace = () => { new ManageStorageDlg().open(); };
    static toggleEditMode = () => S.edit.toggleEditMode(getAppState(null));
    static toggleMetaData = () => S.edit.toggleShowMetaData(getAppState(null));
    static toggleNsfw = () => S.edit.toggleNsfw(getAppState(null));
    static toggleShowProps = () => S.edit.toggleShowProps(getAppState(null));
    static toggleParents = () => S.edit.toggleShowParents(getAppState(null));
    static toggleReplies = () => S.edit.toggleShowReplies(getAppState(null));
    static browserInfo = () => S.util.showBrowserInfo();
    static mobileToggle = () => S.util.switchBrowsingMode();

    preRender(): void {
        const appState = useAppState();
        const state = this.getState();

        const hltNode = S.nodeUtil.getHighlightedNode(appState);
        const selNodeIsMine = !!hltNode && (hltNode.owner === appState.userName || appState.userName === "admin");
        const transferFromMe = !!hltNode && hltNode.transferFromId === appState.userProfile?.userNodeId;
        const transferring = !!hltNode && !!hltNode.transferFromId;

        const importFeatureEnabled = selNodeIsMine || (!!hltNode && appState.userProfile?.userNodeId === hltNode.id);
        const exportFeatureEnabled = selNodeIsMine || (!!hltNode && appState.userProfile?.userNodeId === hltNode.id);

        const orderByProp = S.props.getPropStr(J.NodeProp.ORDER_BY, hltNode);
        const allowNodeMove: boolean = !orderByProp && S.props.isWritableByMe(appState.node);
        const isPageRootNode = appState.node && hltNode && appState.node.id === hltNode.id;
        const canMoveUp = !isPageRootNode && !appState.isAnonUser && (allowNodeMove && hltNode && hltNode.logicalOrdinal > 0);
        const canMoveDown = !isPageRootNode && !appState.isAnonUser && (allowNodeMove && hltNode && !hltNode.lastChild);

        const children = [];

        const bookmarkItems = [];
        if (!appState.isAnonUser) {
            if (appState.bookmarks) {
                appState.bookmarks.forEach((bookmark: J.Bookmark): boolean => {
                    bookmarkItems.push(new MenuItem(bookmark.name, () => S.view.jumpToId(bookmark.id || bookmark.selfId), true, null));
                    return true;
                });
            }

            const hasBookmarks = bookmarkItems.length > 0;
            if (bookmarkItems.length > 0) {
                bookmarkItems.push(new MenuItemSeparator());
            }
            bookmarkItems.push(new MenuItem("Manage...", MenuPanel.openBookmarksNode, !appState.isAnonUser));

            if (hasBookmarks) {
                children.push(new Menu(state, C.BOOKMARKS_MENU_TEXT, bookmarkItems, null, this.makeHelpIcon(":menu-bookmarks")));
            }
        }

        if (appState.config.menu?.help) {
            children.push(new Menu(state, "Help", this.helpMenuItems(appState)));
        }

        if (!appState.isAnonUser) {
            children.push(new Menu(state, g_brandingAppName, [
                new MenuItem("My Account", S.nav.navToMyAccntRoot, !appState.isAnonUser),
                new MenuItem("My Home", MenuPanel.openHomeNode, !appState.isAnonUser),
                new MenuItem("My Posts", MenuPanel.openPostsNode, !appState.isAnonUser),
                new MenuItemSeparator(),
                new MenuItem("RSS Feeds", MenuPanel.openRSSFeedsNode, !appState.isAnonUser),
                new MenuItem("Notes", MenuPanel.openNotesNode, !appState.isAnonUser),
                new MenuItem("Exports", MenuPanel.openExportsNode, !appState.isAnonUser)
            ], null, this.makeHelpIcon(":menu-tree")));
        }

        // const messagesSuffix = state.newMessageCount > 0
        //     ? " (" + state.newMessageCount + " new)" : "";
        // These options will appear on the RHS for desktop mode
        // No longer needed now that we have RHS as popup (NavDlg)
        // if (state.mobileMode) {
        //     children.push(new Menu(localState, "Feed" + messagesSuffix, [
        //         new MenuItem("To/From Me", S.nav.messagesToFromMe, !state.isAnonUser),
        //         new MenuItem("To Me", S.nav.messagesToMe, !state.isAnonUser),
        //         new MenuItem("From Me", S.nav.messagesFromMe, !state.isAnonUser),
        //         new MenuItemSeparator(),
        //         new MenuItem("From Friends", S.nav.messagesFromFriends, !state.isAnonUser),
        //         // We need to make this a configurable option.
        //         // new MenuItem("From Local Users", S.nav.messagesLocal),
        //         new MenuItem("Federated", S.nav.messagesFediverse)
        //     ], null, this.makeHelpIcon(":menu-feed")));

        //     children.push(new Menu(localState, "Trending", [
        //         new MenuItem("Hashtags", S.nav.showTrendingHashtags),
        //         new MenuItem("Mentions", S.nav.showTrendingMentions),
        //         new MenuItem("Words", S.nav.showTrendingWords)
        //     ]));
        // }

        children.push(new Menu(state, "People", [
            new MenuItem("Friends", MenuPanel.openFriendsNode, !appState.isAnonUser),
            new MenuItem("Followers", MenuPanel.showFollowers, !appState.isAnonUser),
            new MenuItem("Blocked", MenuPanel.openBlockedUsersNode, !appState.isAnonUser),
            new MenuItemSeparator(),
            new MenuItem("Find People", MenuPanel.findUsers, !appState.isAnonUser), //

            /* It would be possible to allow this multiFollow capability for all users, but I don't want to make it that easy
             to create a heavy server load for now. Users can add one at a time for now, and only the FollowBot user has
             this superpower. */
            appState.userName === J.PrincipalName.FOLLOW_BOT ? new MenuItem("Multi-Follow", MenuPanel.multiFollow) : null //
        ], null, this.makeHelpIcon(":menu-people")));

        children.push(new Menu(state, "Edit", [
            appState.editNode ? new MenuItem("Continue editing...", MenuPanel.continueEditing, !appState.isAnonUser) : null, //
            new MenuItem("Clear Selections", S.nodeUtil.clearSelNodes, !appState.isAnonUser && appState.selectedNodes.size > 0), //

            // new MenuItem("Cut", S.edit.cutSelNodes, () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine }), //
            new MenuItem("Undo Cut", S.edit.undoCutSelNodes, !appState.isAnonUser && !!appState.nodesToMove), //

            // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

            new MenuItem("Update Headings", S.edit.updateHeadings, !appState.isAnonUser && selNodeIsMine), //
            new MenuItem("Search and Replace", MenuPanel.searchAndReplace, !appState.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Split Node", MenuPanel.splitNode, !appState.isAnonUser && selNodeIsMine), //
            new MenuItem("Join Nodes", MenuPanel.joinNodes, !appState.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Move to Top", S.edit.moveNodeToTop, canMoveUp), //
            new MenuItem("Move to Bottom", S.edit.moveNodeToBottom, canMoveDown), //

            new MenuItemSeparator(), //
            new MenuItem("Delete", S.edit.deleteSelNodes, !appState.isAnonUser && selNodeIsMine) //

            // todo-2: disabled during mongo conversion
            // new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
            // new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
            //    () => { return state.isAdminUser && highlightNode != null }, //
            //    () => { return state.isAdminUser }, //
            //    true
            // ), //
        ], null, this.makeHelpIcon(":menu-edit")));

        const createMenuItems: CompIntf[] = [];
        const typeHandlers = S.plugin.getAllTypeHandlers();
        typeHandlers.forEach((typeHandler: TypeHandlerIntf, k: string): boolean => {
            if (appState.isAdminUser || typeHandler.getAllowUserSelect()) {
                createMenuItems.push(new MenuItem(typeHandler.getName(), () => S.edit.createNode(hltNode, typeHandler.getTypeName(), true, true, null, null, appState), //
                    !appState.isAnonUser && !!hltNode));
            }
            return true;
        });

        children.push(new Menu(state, "Create", createMenuItems, null, this.makeHelpIcon(":menu-create")));

        children.push(new Menu(state, "Search", [
            new MenuItem("By Content", MenuPanel.searchByContent, !appState.isAnonUser && !!hltNode), //
            new MenuItem("By Node Name", MenuPanel.searchByName, !appState.isAnonUser), //
            new MenuItem("By Node ID", MenuPanel.searchById, !appState.isAnonUser), //

            // moved into editor dialog
            // new MenuItem("Edit Node Sharing", () => S.edit.editNodeSharing(state), //
            //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Shared Nodes", MenuPanel.showAllShares, //
                !appState.isAnonUser && !!hltNode),

            new MenuItem("Public Read-only", MenuPanel.showPublicReadonlyShares, //
                !appState.isAnonUser && !!hltNode),

            new MenuItem("Public Appendable", MenuPanel.showPublicWritableShares, //
                !appState.isAnonUser && !!hltNode),

            new MenuItemSeparator(), //

            new MenuItem("Priority Listing", MenuPanel.listSubgraphByPriority, //
                !appState.isAnonUser && !!hltNode)

            // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch },
            //    () => { return  !state.isAnonUser && S.quanta.allowFileSystemSearch })
        ], null, this.makeHelpIcon(":menu-search")));

        children.push(new Menu(state, "Timeline", [
            // todo-1: need to see if this is easy to turn on for non-logged in users.
            new MenuItem("Live Rev-Chron (Chat Room)", () => S.nav.messagesNodeFeed(appState), !appState.isAnonUser && hltNode?.id != null),
            new MenuItemSeparator(), //
            new MenuItem("Created", MenuPanel.timelineByCreated, !appState.isAnonUser && !!hltNode), //
            new MenuItem("Modified", MenuPanel.timelineByModified, !appState.isAnonUser && !!hltNode), //
            new MenuItemSeparator(), //
            new MenuItem("Created (non-Recursive)", MenuPanel.timelineByCreatedNonRecursive, !appState.isAnonUser && !!hltNode), //
            new MenuItem("Modified (non-Recursive)", MenuPanel.timelineByModifiedNonRecursive, !appState.isAnonUser && !!hltNode) //
        ], null, this.makeHelpIcon(":menu-timeline")));

        children.push(new Menu(state, "Calendar", [
            new MenuItem("Display", MenuPanel.showCalendar, !appState.isAnonUser && !!hltNode),
            new MenuItemSeparator(), //
            new MenuItem("Future", MenuPanel.calendarFutureDates, !appState.isAnonUser && !!hltNode), //
            new MenuItem("Past", MenuPanel.calendarPastDates, !appState.isAnonUser && !!hltNode), //
            new MenuItem("All", MenuPanel.calendarAllDates, !appState.isAnonUser && !!hltNode) //
        ]));

        children.push(new Menu(state, "Tools", [
            // new MenuItem("IPFS Explorer", MenuPanel.toolsShowIpfsTab), //

            new MenuItem("Import", MenuPanel.import, importFeatureEnabled),
            new MenuItem("Export", MenuPanel.export, exportFeatureEnabled),
            new MenuItemSeparator(), //

            new MenuItem("Test Microphone", MenuPanel.testMicrophone, !appState.isAnonUser), //
            new MenuItem("Test Web Cam", MenuPanel.testWebCam, !appState.isAnonUser), //
            new MenuItem("My GEO Location", S.nav.geoLocation), //
            new MenuItemSeparator(), //

            !state.unknownPubSigKey && S.crypto.avail ? new MenuItem("Sign", MenuPanel.signSubGraph, !appState.isAnonUser && selNodeIsMine) : null, //
            new MenuItem("Verify Signatures", MenuPanel.nodeSignatureVerify, !appState.isAnonUser && selNodeIsMine), //
            new MenuItem("Generate SHA256", MenuPanel.subgraphHash, !appState.isAnonUser && selNodeIsMine) //

            // Removing for now. Our PostIt node icon makes this easy enough.
            // new MenuItem("Save Clipboard", MenuPanel.toolsShowClipboard, !state.isAnonUser), //

            // DO NOT DELETE
            // new MenuItem("Open IPSM Console", MenuPanel.setIpsmActive, !state.isAnonUser) //
        ], null, this.makeHelpIcon(":menu-tools")));

        children.push(new Menu(state, "Node Info", [
            // I decided with this on the toolbar we don't need it repliated here.
            // !state.isAnonUser ? new MenuItem("Save clipboard (under Notes node)", () => S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES)) : null, //

            new MenuItem("Show URLs", MenuPanel.showUrls, !!hltNode), //
            new MenuItem("Show Raw Data", MenuPanel.showRawData, !appState.isAnonUser && selNodeIsMine), //
            appState.isAdminUser ? new MenuItem("Show ActivityPub JSON", MenuPanel.showActPubJson) : null, //
            new MenuItemSeparator(), //

            new MenuItem("Node Stats", MenuPanel.nodeStats, !appState.isAnonUser) //

            // This menu item works, but will have little value to users, because the only difference between this and 'Node Stats', is that
            // the 'trending' stats is defined as the 'Node Stats' for the most recent 500 results in the query. I had a need for this early on
            // because this is how the Feed View (Fediverse) stats is done, using arbitrarily chosen number 500 most recent posts as the universe
            // of data to pick the statistics from, but this arbitrary number 500 just won't be helpful on any sub-graph for any ordinary users (yet)
            // because you'd need a document with many thousands of nodes before the "top 500" will have any real significance as a 'trending' definition.
            // new MenuItem("Trending Stats", () => S.view.getNodeStats(state, true, false), //
            //     !state.isAnonUser /* state.isAdminUser */) //
        ], null, this.makeHelpIcon(":menu-node-info")));

        children.push(new Menu(state, "Transfer", [
            new MenuItem("Transfer", MenuPanel.transferNode, !appState.isAnonUser && selNodeIsMine && !transferring), //
            new MenuItem("Accept", MenuPanel.acceptTransfer, !appState.isAnonUser && selNodeIsMine && transferring), //
            new MenuItem("Reject", MenuPanel.rejectTransfer, !appState.isAnonUser && selNodeIsMine && transferring), //
            new MenuItem("Reclaim", MenuPanel.reclaimTransfer, !appState.isAnonUser && transferFromMe) //

            // todo-1: need "Show Incomming" transfers menu option
        ], null, this.makeHelpIcon(":transfers")));

        children.push(new Menu(state, "Settings", [
            // DO NOT DELETE (for now we don't need these since the NAV/RHS panel has them already)
            // new MenuItem("Edit", MenuPanel.toggleEditMode, !state.isAnonUser, () => state.userPrefs.editMode), //
            // new MenuItem("Info/Metadata", MenuPanel.toggleMetaData, true, () => state.userPrefs.showMetaData), //

            new MenuItem("Show Sensitive Content", MenuPanel.toggleNsfw, true, () => appState.userPrefs.nsfw), //
            new MenuItem("Show Parent", MenuPanel.toggleParents, true, () => appState.userPrefs.showParents), //
            new MenuItem("Show Comments", MenuPanel.toggleReplies, true, () => appState.userPrefs.showReplies), //

            // for now, we don't need the 'show properties' and it may never be needed again
            new MenuItem("Show Properties", MenuPanel.toggleShowProps, true, () => appState.userPrefs.showProps), //
            // For now there is only ONE button on the Perferences dialog that is accessible as a toolbar button already, so

            // until we have at least one more preference the preferences dialog is not needed.
            // new MenuItem("Preferences", () => {new PrefsDlg().open();}, !state.isAnonUser), // "fa-gear"

            new MenuItemSeparator(), //
            /* The mouse effect shows a grapical animation for each mouse click but I decided I don't like the fact
             that I have to impose an intentional performance lag to let the animation show up, so in order to have the
             absolute fastest snappiest response of the app, I'm just not using this mouseEffect for now but let's leave
             the code in place for future reference. */
            new MenuItem("Mouse Effects", MenuPanel.mouseEffects, !appState.isAnonUser && !appState.mobileMode, () => S.domUtil.mouseEffect),

            new MenuItem("Browser Info", MenuPanel.browserInfo), //
            new MenuItem(appState.mobileMode ? "Desktop Browser" : "Moble Browser", MenuPanel.mobileToggle) //

            // menuItem("Full Repository Export", "fullRepositoryExport", "
            // S.edit.fullRepositoryExport();") + //
        ]));

        children.push(new Menu(state, "Account", [
            !appState.isAnonUser ? new MenuItem("Logout", S.user.userLogout, !appState.isAnonUser) : null, //
            appState.isAnonUser ? new MenuItem("Signup", S.user.userSignup, appState.isAnonUser) : null, //
            new MenuItemSeparator(), //
            new MenuItem("Profile", MenuPanel.profile, !appState.isAnonUser), //
            new MenuItem("Storage Space", MenuPanel.storageSpace, !appState.isAnonUser), //
            new MenuItem("Security Keys", MenuPanel.showKeys, S.crypto.avail && !appState.isAnonUser), //
            new MenuItem("Change Password", MenuPanel.changePassword, !appState.isAnonUser), //
            new MenuItemSeparator(), //
            new MenuItem("Bulk Delete", MenuPanel.bulkDelete, !appState.isAnonUser), //
            new MenuItem("Close Account", MenuPanel.closeAccount, !appState.isAnonUser) //
        ], null, this.makeHelpIcon(":account")));

        // //need to make export safe for end users to use (recarding file sizes)
        // if (state.isAdminUser) {
        //     children.push(new Menu(localState, "Admin Tools", [
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
        if (appState.isAdminUser) {
            // DO NOT DELETE: Work in Progress....
            // children.push(new Menu(localState, "IPFS", [
            //     new MenuItem("Sync: To IPFS", () => S.nodeUtil.publishNodeToIpfs(hltNode), //
            //         state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)), //
            //     new MenuItem("Sync: From IPFS", () => S.nodeUtil.loadNodeFromIpfs(hltNode), //
            //         state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine)) //
            // ]));
        }

        if (appState.isAdminUser) {
            children.push(new Menu(state, "Admin - Analytic", [

                // new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                new MenuItem("Server Info", () => S.view.runServerCommand("getServerInfo", null, "Info View", null, appState)), //
                new MenuItem("View Session Activity", () => S.view.runServerCommand("getSessionActivity", null, "Session Activity", null, appState)), //
                new MenuItem("Performance Report", () => window.open(S.util.getHostAndPort() + "/performance-report", "_blank")) //
            ]));
            children.push(new Menu(state, "Admin - Utils", [

                // new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                new MenuItem("Create User", MenuPanel.createUser), //
                new MenuItem("Toggle Daemons", () => S.view.runServerCommand("toggleDaemons", null, "Toggle Daemons", null, appState)), //
                new MenuItem("Toggle AuditFilter", () => S.view.runServerCommand("toggleAuditFilter", null, "Toggle AuditFilter", null, appState)), //
                new MenuItem("Send Restart Warning", () => S.view.runServerCommand("sendAdminNote", null, "Admin Note", null, appState)), //
                new MenuItem("Refresh RSS Cache", () => S.view.runServerCommand("refreshRssCache", null, "Refresh RSS Cache", null, appState)), //
                new MenuItem("Insert Book: War and Peace", () => S.edit.insertBookWarAndPeace(appState))
            ]));

            children.push(new Menu(state, "Admin - DB", [
                new MenuItem("Validate", () => S.view.runServerCommand("validateDb", null, "Validate DB Response", null, appState)), //
                new MenuItem("Repair", () => S.view.runServerCommand("repairDb", null, "Repair DB Response", null, appState)), //
                new MenuItem("Compact DB & Cleanup Pins", () => S.view.runServerCommand("compactDb", null, "Compact DB Response", null, appState)), //
                new MenuItem("Run DB Conversion", () => S.view.runServerCommand("runConversion", null, "Run DB Conversion", null, appState)), //
                new MenuItem("Rebuild Indexes", () => S.view.runServerCommand("rebuildIndexes", null, "Rebuild Indexes Response", null, appState)), //
                new MenuItem("Lucene: Refresh", () => S.view.runServerCommand("refreshLuceneIndex", null, null, null, appState)),
                new MenuItem("Delete Node (w/ Orphans)", () => S.view.runServerCommand("deleteLeavingOrphans", null, "Delete node leaving orphans", null, appState)) //
            ]));

            children.push(new Menu(state, "Admin - ActivityPub", [
                new MenuItem("Fediverse Users", () => window.open(S.util.getHostAndPort() + "/fediverse-users", "_blank")), //
                new MenuItem("Get JSON from URL", MenuPanel.readJSONfromURL), //
                new MenuItem("Refresh Fediverse", () => S.view.runServerCommand("refreshFediverseUsers", null, "Refresh Fediverse Users", null, appState)), //
                new MenuItem("Refresh AP Accts", () => S.view.runServerCommand("refreshAPAccounts", null, "Refresh AP Accounts", null, appState)), //
                new MenuItem("ActPub Maintenance", () => S.view.runServerCommand("actPubMaintenance", null, "ActPub Maintenance Response", null, appState)), //
                new MenuItem("Crawl Fediverse", () => S.view.runServerCommand("crawlUsers", null, "ActPub Crawl Response", null, appState))
            ]));

            children.push(new Menu(state, "Admin - Test", [
                new MenuItem("IPFS PubSub", () => S.view.runServerCommand("ipfsPubSubTest", null, "PubSub Test", null, appState)), //
                new MenuItem("Send Email", () => S.util.sendTestEmail()),
                new MenuItem("Server Log Text", () => S.util.sendLogText()),
                new MenuItem("Notification Display", () => S.util.showSystemNotification("Test Title", "This is a test message")),
                new MenuItem("WebCrypto Encryption", async () => {
                    await S.crypto.encryptionTest();
                    S.util.showMessage("Crypto Test Complete. Check browser console for output.", "Note", true);
                }),
                new MenuItem("WebCrypto Signatures", async () => {
                    await S.crypto.signatureTest();
                    S.util.showMessage("Crypto Test Complete. Check browser console for output.", "Note", true);
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
                    const sayThis = new SpeechSynthesisUtterance("Wow. Browsers now support Text to Speech driven by JavaScript");
                    tts.speak(sayThis);
                })
            ]));
        }

        this.setChildren(children);
    }

    makeHelpIcon = (nodeName: string): Tag => {
        return new Tag("i", {
            className: "fa fa-question-circle fa-lg float-end menuIcon",
            title: "Display Help Information",
            onClick: (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
                // S.view.jumpToId(bookmark.selfId);
                S.nav.openContentNode(nodeName);
            }
        });
    }

    // These are defined externally in config-text.yaml
    helpMenuItems = (state: AppState): Div[] => {
        const items: Div[] = [];
        if (state.config.menu?.help) {
            for (const menuItem of state.config.menu.help) {
                if (menuItem.name === "separator") {
                    items.push(new MenuItemSeparator());
                }
                else {
                    const link: string = menuItem.link;
                    let func: Function = null;

                    if (link) {
                        // allows ability to select a tab
                        if (link.startsWith("tab:")) {
                            const tab = link.substring(4);

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
}

PubSub.sub(C.PUBSUB_menuClicked, (name: string) => {
    MenuPanel.inst?.onMount(() => {
        const state: MenuPanelState = MenuPanel.inst.getState();
        if (state.expanded.has(name)) {
            state.expanded.delete(name);
            state.lastAction = "collapse";
        }
        else {
            state.expanded.add(name);
            state.lastAction = "expand";
        }
        state.lastClicked = name;
        MenuPanel.inst.mergeState(state);
    });
});
