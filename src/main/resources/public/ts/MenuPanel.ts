import { useSelector } from "react-redux";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { ImportCryptoKeyDlg } from "./dlg/ImportCryptoKeyDlg";
import { ManageEncryptionKeysDlg } from "./dlg/ManageEncryptionKeysDlg";
import { MediaRecorderDlg } from "./dlg/MediaRecorderDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Div } from "./widget/Div";
import { Menu } from "./widget/Menu";
import { MenuItem } from "./widget/MenuItem";
import { MenuItemSeparator } from "./widget/MenuItemSeparator";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MenuPanel extends Div {

    constructor(state: AppState) {
        super(null, {
            id: "accordion",
            role: "tablist",
            className: "menuPanel"
        });
    }

    preRender(): void {
        const state: AppState = useSelector((state: AppState) => state);

        const selNodeCount = S.util.getPropertyCount(state.selectedNodes);
        const hltNode = S.meta64.getHighlightedNode(state);
        const selNodeIsMine = !!hltNode && (hltNode.owner === state.userName || state.userName === "admin");

        const importFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);
        const exportFeatureEnabled = selNodeIsMine || (!!hltNode && state.homeNodeId === hltNode.id);

        const orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, hltNode);
        const allowNodeMove: boolean = !orderByProp && S.edit.isInsertAllowed(state.node, state);
        const isPageRootNode = state.node && hltNode && state.node.id === hltNode.id;
        const canMoveUp = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && hltNode.logicalOrdinal > 0);
        const canMoveDown = !isPageRootNode && !state.isAnonUser && (allowNodeMove && hltNode && !hltNode.lastChild);

        const children = [];

        children.push(new Menu("Site Nav", [
            new MenuItem("Your Root Node", () => S.nav.navHome(state), !state.isAnonUser),
            new MenuItem("Portal Home", () => S.meta64.loadAnonPageHome(state)),
            new MenuItem("User Guide", () => S.nav.openContentNode(":user-guide", state)),
            new MenuItem("Logout", () => S.nav.logout(state), !state.isAnonUser)
        ]));

        // WARNING: The string 'Social' is also in Menu.activeMenu, to set the default menu that's opened
        children.push(new Menu("Social", [

            // These are unneeded, because they're icons on the upper right corner.
            // new MenuItem("Welcome", () => { window.location.href = window.location.origin; }),
            // new MenuItem("Home", () => S.meta64.loadAnonPageHome(state)),
            // new MenuItem("Account Root", () => S.nav.navHome(state), !state.isAnonUser),

            new MenuItem("Inbox", () => S.nav.openContentNode("~" + J.NodeType.INBOX, state), !state.isAnonUser),
            new MenuItem("Outbox", () => S.nav.openContentNode("~" + J.NodeType.USER_FEED, state), !state.isAnonUser),
            new MenuItem("Friends", () => S.nav.openContentNode("~" + J.NodeType.FRIEND_LIST, state), !state.isAnonUser),

            // this appears to be broken for user 'bob' at least. Also "Show Feed" is broken on the feed node
            new MenuItem("Feed", () => S.nav.navFeed(state), !state.isAnonUser)

            // I'm removing my RSS feeds, for now (mainly to remove any political or interest-specific content from the platform)
            // new MenuItem("Podcast Feeds", () => { S.nav.openContentNode("/r/rss"); }),

            // new MenuItem("Sample Document", () => { S.nav.openContentNode("/r/books/war-and-peace"); }),

            // this is on nav bar already
            // new MenuItem("Logout", () => S.nav.logout(state)),

            // I decided ALL information will be stored native right in mongo, and no filesystem stuff.
            // new MenuItem("Documentation", () => { S.nav.openContentNode("/r/public/subnode-docs"); }),
        ]));

        children.push(new Menu("Edit", [
            !clientInfo.isMobile ? null : new MenuItem("Toggle Edit Mode", () => S.edit.toggleEditMode(state), !state.isAnonUser), //
            !clientInfo.isMobile ? null : new MenuItemSeparator(), //

            // new MenuItem("Cut", S.edit.cutSelNodes, () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine }), //
            new MenuItem("Undo Cut", () => S.edit.undoCutSelNodes(state), !state.isAnonUser && !!state.nodesToMove), //

            // new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

            new MenuItem("Clear Selections", () => S.meta64.clearSelNodes(state), !state.isAnonUser && selNodeCount > 0), //
            new MenuItem("Split Node", () => new SplitNodeDlg(null, state).open(), !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Transfer Node", () => { new TransferNodeDlg(state).open(); }, !state.isAnonUser && selNodeIsMine), //
            new MenuItem("Update Headings", () => { S.edit.updateHeadings(state); }, !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Move to Top", () => S.edit.moveNodeToTop(null, state), canMoveUp), //
            new MenuItem("Move to Bottom", () => S.edit.moveNodeToBottom(null, state), canMoveDown), //
            new MenuItemSeparator(), //

            new MenuItem("Permanent Delete", () => S.edit.deleteSelNodes(null, true, state), !state.isAnonUser && selNodeCount > 0 && selNodeIsMine), //
            new MenuItem("Show Trash Bin", () => S.nav.openContentNode(state.homeNodePath + "/d", state), !state.isAnonUser)

            // todo-1: disabled during mongo conversion
            // new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
            // new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
            //    () => { return state.isAdminUser && highlightNode != null }, //
            //    () => { return state.isAdminUser }, //
            //    true
            // ), //
        ]));

        children.push(new Menu("Share", [
            // moved into editor dialog
            // new MenuItem("Edit Node Sharing", () => S.share.editNodeSharing(state), //
            //     !state.isAnonUser && !!highlightNode && selNodeIsMine), //

            new MenuItem("Show All Shares", () => S.share.findSharedNodes(state, null), //
                !state.isAnonUser && !!hltNode),

            new MenuItem("Show Public Shares", () => S.share.findSharedNodes(state, "public"), //
                !state.isAnonUser && !!hltNode)
        ]));

        children.push(new Menu("Search", [

            new MenuItem("All Content", () => { new SearchContentDlg(state).open(); }, //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("By Name", () => { new SearchByNameDlg(state).open(); }, //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("By ID", () => { new SearchByIDDlg(state).open(); }, //
                !state.isAnonUser && !!hltNode) //

            // new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch },
            //    () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch })
        ]));

        children.push(new Menu("Timeline", [

            new MenuItem("Created", () => S.srch.timeline("ctm", state), //
                !state.isAnonUser && !!hltNode), //

            new MenuItem("Modified", () => S.srch.timeline("mtm", state), //
                !state.isAnonUser && !!hltNode) //
        ]));

        children.push(new Menu("Tools", [
            new MenuItem("Show Graph", () => S.render.showGraph(null, null, state), !!hltNode), //

            // todo-1: properties toggle really should be a preferences setting i think, and not a menu option here.

            // this is broken, so I'm just disabling it for now, since this is low priority. todo-1
            // new MenuItem("Toggle Properties", S.props.propsToggle, () => { return propsToggle }, () => { return !state.isAnonUser }), //

            // calendar is experimental and only shown for admin user currently
            state.isAdminUser ? new MenuItem("Show Calendar", () => S.render.showCalendar(null, state), !!hltNode) : null, //
            !state.isAnonUser ? new MenuItem("Save Clipboard", () => S.edit.saveClipboardToChildNode()) : null, //

            new MenuItem("Show URLs", () => S.render.showNodeUrl(null, state), !!hltNode), //

            new MenuItem("Show Raw Data", () => S.view.runServerCommand("getJson", "Node JSON Data", "The actual data stored on the server for this node...", state), //
                !state.isAnonUser && selNodeIsMine), //

            new MenuItemSeparator(), //

            new MenuItem("Import", () => S.edit.openImportDlg(state), importFeatureEnabled),
            new MenuItem("Export", () => S.edit.openExportDlg(state), exportFeatureEnabled),

            new MenuItemSeparator(), //

            new MenuItem("Test Microphone", () => { new MediaRecorderDlg(state, false, false).open(); }, !state.isAnonUser),
            new MenuItem("Test Web Cam", () => { new MediaRecorderDlg(state, true, false).open(); }, !state.isAnonUser)
        ]));

        children.push(new Menu("Encrypt", [
            new MenuItem("Show Keys", () => { new ManageEncryptionKeysDlg(state).open(); }, !state.isAnonUser), //
            new MenuItem("Generate Keys", () => { S.util.generateNewCryptoKeys(state); }, !state.isAnonUser), //
            new MenuItem("Publish Keys", () => { S.encryption.initKeys(false, true); }, !state.isAnonUser), //
            new MenuItem("Import Keys", () => { new ImportCryptoKeyDlg(state).open(); }, !state.isAnonUser) //
        ]));

        // //need to make export safe for end users to use (recarding file sizes)
        // if (state.isAdminUser) {
        //     children.push(new Menu("Admin Tools", [
        //         //todo-1: disabled during mongo conversion
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

        children.push(new Menu("Account", [
            new MenuItem("Profile", () => S.edit.openProfileDlg(state), !state.isAnonUser), //
            new MenuItem("Preferences", () => S.edit.editPreferences(state), !state.isAnonUser), // "fa-gear"
            new MenuItem("Change Password", () => S.edit.openChangePasswordDlg(state), !state.isAnonUser), //
            new MenuItem("Manage Account", () => S.edit.openManageAccountDlg(state), !state.isAnonUser) //

            // menuItem("Full Repository Export", "fullRepositoryExport", "
            // S.edit.fullRepositoryExport();") + //
        ]));

        if (state.isAdminUser) {
            children.push(new Menu("IPFS", [
                new MenuItem("Display Node Info", () => S.view.runServerCommand("ipfsGetNodeInfo", "IPFS Node Info", null, state), //
                    state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine))
            ]));
        }

        if (state.isAdminUser) {
            children.push(new Menu("Lucene", [
                // new MenuItem("Run Test", () => {S.view.runServerCommand("luceneTest")},
                //     () => { return state.isAdminUser },
                //     () => { return state.isAdminUser }
                // ),
                new MenuItem("Refresh Index", () => S.view.runServerCommand("refreshLuceneIndex", null, null, state))
            ]));
        }

        if (state.isAdminUser) {
            children.push(new Menu("Admin", [
                new MenuItem("Server Info", () => S.view.runServerCommand("getServerInfo", "Server Info", null, state)), //
                new MenuItem("Compact DB", () => S.view.runServerCommand("compactDb", "Compact DB Response", null, state)), //
                new MenuItem("Refresh RSS Cache", () => S.view.runServerCommand("refreshRssCache", "Refresh RSS Cache", null, state)), //

                new MenuItem("Backup DB", () => S.view.runServerCommand("BackupDb", "Backup DB Response", null, state)), //
                new MenuItem("Reset Public Node", () => S.view.runServerCommand("initializeAppContent", null, null, state)), //
                new MenuItem("Insert Book: War and Peace", () => S.edit.insertBookWarAndPeace(state)),

                new MenuItem("Rebuild Indexes", () => S.meta64.rebuildIndexes()),
                new MenuItem("Shutdown Server Node", () => S.meta64.shutdownServerNode(state)),
                new MenuItem("Send Test Email", () => S.meta64.sendTestEmail(state)),
                new MenuItem("Encryption Test", async () => {
                    await S.encryption.test();
                    S.util.showMessage("Encryption Test Complete. Check browser console for output.", "Note", true);
                }),
                new MenuItem("TTS Test", async () => {
                    const tts = window.speechSynthesis;
                    // let voices = tts.getVoices();
                    // for (let i = 0; i < voices.length; i++) {
                    //     let voice = voices[i];
                    //     // Google UK English Female (en-GB)
                    //     console.log("Voice: " + voice.name + " (" + voice.lang + ") " + (voice.default ? "<-- Default" : ""));
                    // }

                    /* WARNING: speechSynthesis seems to crash very often and leave hung processes, eating up CPU, at least
                    on my Ubuntu 18.04, machine, so for now any TTS development is on hold. */
                    var utterThis = new SpeechSynthesisUtterance("Wow. Browsers now support Text to Speech driven by JavaScript");
                    tts.speak(utterThis);
                })
            ]));
        }

        this.setChildren(children);
    }
}
