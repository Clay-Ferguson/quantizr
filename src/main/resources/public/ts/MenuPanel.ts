import * as J from "./JavaIntf";
import { Menu } from "./widget/Menu";
import { MenuItem } from "./widget/MenuItem";
import { Div } from "./widget/Div";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { SearchByNameDlg } from "./dlg/SearchByNameDlg";
import { SearchByIDDlg } from "./dlg/SearchByIDDlg";
import { SplitNodeDlg } from "./dlg/SplitNodeDlg";
import { ManageEncryptionKeysDlg } from "./dlg/ManageEncryptionKeysDlg";
import { TransferNodeDlg } from "./dlg/TransferNodeDlg";
import { AppState } from "./AppState";
import { useSelector, useDispatch } from "react-redux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class MenuPanel extends Div {

    constructor(state: AppState) {
        super(null, {
            id: "accordion",
            role: "tablist"
        });
    }

    preRender = (): void => {
        let state: AppState = useSelector((state: AppState) => state);

        let selNodeCount = S.util.getPropertyCount(state.selectedNodes);
        let highlightNode = S.meta64.getHighlightedNode(state);
        let selNodeIsMine = highlightNode != null && (highlightNode.owner === state.userName || "admin" === state.userName);

        //for now, allowing all users to import+export (todo-2)
        let importFeatureEnabled = state.isAdminUser || state.userPreferences.importAllowed;
        let exportFeatureEnabled = state.isAdminUser || state.userPreferences.exportAllowed;

        let orderByProp = S.props.getNodePropVal(J.NodeProp.ORDER_BY, highlightNode);
        let allowNodeMove: boolean = !orderByProp;

        let canMoveUp = allowNodeMove && highlightNode && !highlightNode.firstChild;
        let canMoveDown = allowNodeMove && highlightNode && !highlightNode.lastChild;

        let propsToggle = state.node && !state.isAnonUser;
        let allowEditMode = state.node && !state.isAnonUser;

        this.setChildren([
            new Menu("Navigate", [
                new MenuItem("Home Node", () => S.nav.navHome(state),
                    //enabled func
                    () => {
                        return !state.isAnonUser;
                    }
                ),
                new MenuItem("Inbox", () => S.nav.openContentNode(state.homeNodePath + "/inbox", state),
                    //enabled func
                    () => {
                        return !state.isAnonUser;
                    }
                ),
                new MenuItem("Portal Node", () => S.meta64.loadAnonPageHome(state) ),

                //I'm removing my RSS feeds, for now (mainly to remove any political or interest-specific content from the platform)
                //new MenuItem("Podcast Feeds", () => { S.nav.openContentNode("/r/rss"); }),

                new MenuItem("User Guide", () => S.nav.openContentNode(":user-guide", state) ),

                //new MenuItem("Sample Document", () => { S.nav.openContentNode("/r/books/war-and-peace"); }),

                new MenuItem("Getting Started", () => S.nav.openContentNode(":getting-started", state) ),

                new MenuItem("Logout", () => S.nav.logout(state)),

                //I decided ALL information will be stored native right in mongo, and no filesystem stuff.
                //new MenuItem("Documentation", () => { S.nav.openContentNode("/r/public/subnode-docs"); }),
            ]),
            new Menu("Edit", [              
                //new MenuItem("Cut", S.edit.cutSelNodes, () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine }), //
                new MenuItem("Undo Cut", S.edit.undoCutSelNodes, () => { return !state.isAnonUser && state.nodesToMove != null }), //

                /*
                I have this feature 90% complete but near the end i realized i have a problem with id v.s. uid, because uid
                is only a client-side assigned thing, so i will need to convert my entire 'selectedNodes' over to store
                actual node 'ids' (that long hex value string) to finish this which will take some time.
                */
                //new MenuItem("Select All", S.edit.selectAllNodes, () => { return  !state.isAnonUser }), //

                new MenuItem("Clear Selections", () => S.meta64.clearSelNodes(state), () => { return !state.isAnonUser && selNodeCount > 0 }), //
                new MenuItem("Move to Top", () => S.edit.moveNodeToTop(null, state), () => { return canMoveUp; }), //
                new MenuItem("Move to Bottom", () => S.edit.moveNodeToBottom(null, state), () => { return canMoveDown; }),//
                new MenuItem("Permanent Delete", () => S.edit.deleteSelNodes(null, true, state), () => { return !state.isAnonUser && selNodeCount > 0 && selNodeIsMine; }), //
                new MenuItem("Show Trash Bin", () => S.nav.openContentNode(state.homeNodePath + "/d", state),
                    //enabled func
                    () => {
                        return !state.isAnonUser;
                    }
                ),
                new MenuItem("Empty Trash", () => S.edit.emptyTrash(state),
                //enabled func
                () => {
                    return !state.isAnonUser;
                }
            ),
                
            ]),
            new Menu("Uploads", [
                new MenuItem("Upload from File", () => S.attachment.openUploadFromFileDlg(false, null, null, state), () => { return !state.isAnonUser && highlightNode != null && selNodeIsMine }), //
                new MenuItem("Upload from URL", () => S.attachment.openUploadFromUrlDlg(null, null, state), () => { return !state.isAnonUser && highlightNode != null && selNodeIsMine }), //
                new MenuItem("Upload to IPFS", () => S.attachment.openUploadFromFileDlg(true, null, null, state), () => { return !state.isAnonUser && highlightNode != null && selNodeIsMine }), //
                new MenuItem("Delete Attachment", () => S.attachment.deleteAttachment(state), () => {
                    return !state.isAnonUser && highlightNode != null
                        && S.props.hasBinary(highlightNode) && selNodeIsMine
                })
            ]),
            new Menu("Share", [
                new MenuItem("Edit Node Sharing", () => S.share.editNodeSharing(state), () => { return !state.isAnonUser && highlightNode != null && selNodeIsMine }), //
                // new MenuItem("Post Node", () => { S.activityPub.postNode(); },//
                //     () => {
                //         return "ramrod" == S.meta64.userName.toLowerCase() ||
                //             "admin" == S.meta64.userName.toLowerCase();
                //         //!state.isAnonUser && highlightNode != null && selNodeIsMine 
                //     }),
                new MenuItem("Show Shared Nodes", () => S.share.findSharedNodes(state), () => { return  !state.isAnonUser && highlightNode != null })
            ]),
            new Menu("Search", [
                new MenuItem("All Content", () => { new SearchContentDlg(state).open(); }, () => { return !state.isAnonUser && highlightNode != null }), //
                new MenuItem("By Name", () => { new SearchByNameDlg(state).open(); }, () => { return !state.isAnonUser && highlightNode != null }), //
                new MenuItem("By ID", () => { new SearchByIDDlg(state).open(); }, () => { return !state.isAnonUser && highlightNode != null }), //

                //new MenuItem("Files", nav.searchFiles, () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch },
                //    () => { return  !state.isAnonUser && S.meta64.allowFileSystemSearch })
            ]),

            //NOTE:Graph feature is fully functional, but not ready to deploy yet.
            // new Menu("Graph", [
            //     new MenuItem("Tree Structure", S.graph.graphTreeStructure, () => { return !state.isAnonUser && highlightNode != null }), //
            // ]),
            new Menu("Timeline", [
                new MenuItem("Created", () => S.srch.timeline('ctm', state) , () => { return !state.isAnonUser && highlightNode != null }), //
                new MenuItem("Modified", () =>  S.srch.timeline('mtm', state) , () => { return !state.isAnonUser && highlightNode != null }), //
            ]),
            
            new Menu("View", [
                //todo-1: properties toggle really should be a preferences setting i think, and not a menu option here.

                //this is broken, so I'm just disabling it for now, since this is low priority. todo-1
                //new MenuItem("Toggle Properties", S.props.propsToggle, () => { return propsToggle }, () => { return !state.isAnonUser }), //

                new MenuItem("Refresh", () => S.meta64.refresh(state)), //
                new MenuItem("Show URL", () => S.render.showNodeUrl(state), () => { return highlightNode != null }), //
                new MenuItem("Show Raw Data", () => S.view.runServerCommand("getJson", state) ,
                    () => { return !state.isAnonUser && selNodeIsMine; },
                    () => { return !state.isAnonUser && selNodeIsMine; }), //
            ]),

            new Menu("Tools",
            [
                new MenuItem("Split Node", () => new SplitNodeDlg(state).open(), () => { return !state.isAnonUser && selNodeIsMine; }), //
                new MenuItem("Transfer Node", () => {new TransferNodeDlg(state).open()}, () => { return !state.isAnonUser && selNodeIsMine; }), //
                //todo-1: disabled during mongo conversion
                //new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
                //new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
                //    () => { return state.isAdminUser && highlightNode != null }, //
                //    () => { return state.isAdminUser }, //
                //    true
                //), //
            ]),

            //need to make export safe for end users to use (recarding file sizes)
            new Menu("Admin Tools",
                [
                    new MenuItem("Import", () => S.edit.openImportDlg(state), //
                        () => { return importFeatureEnabled && (selNodeIsMine || (highlightNode != null && state.homeNodeId == highlightNode.id)) },//
                        () => { return importFeatureEnabled }), //
                    new MenuItem("Export", () => S.edit.openExportDlg(state), //
                        () => { return exportFeatureEnabled && (selNodeIsMine || (highlightNode != null && state.homeNodeId == highlightNode.id)) },
                        () => { return exportFeatureEnabled },
                        true//
                    ), //
                    //todo-1: disabled during mongo conversion
                    //new MenuItem("Set Node A", view.setCompareNodeA, () => { return state.isAdminUser && highlightNode != null }, () => { return state.isAdminUser }), //
                    //new MenuItem("Compare as B (to A)", view.compareAsBtoA, //
                    //    () => { return state.isAdminUser && highlightNode != null }, //
                    //    () => { return state.isAdminUser }, //
                    //    true
                    //), //
                ],
                () => { return state.isAdminUser; },
                () => { return state.isAdminUser; }),

            // WORK IN PROGRESS (do not delete)
            // let fileSystemMenuItems = //
            //     menuItem("Reindex", "fileSysReindexButton", "systemfolder.reindex();") + //
            //     menuItem("Search", "fileSysSearchButton", "systemfolder.search();"); //
            //     //menuItem("Browse", "fileSysBrowseButton", "systemfolder.browse();");
            // let fileSystemMenu = makeTopLevelMenu("FileSys", fileSystemMenuItems);

            new Menu("Account", [
                new MenuItem("Preferences", () => S.edit.editPreferences(state), () => { return !state.isAnonUser }), //
                new MenuItem("Change Password", () => S.edit.openChangePasswordDlg(state), () => { return !state.isAnonUser }), //
                new MenuItem("Manage Account", () => S.edit.openManageAccountDlg(state), () => { return !state.isAnonUser }), //
                new MenuItem("Encryption Keys", () => { new ManageEncryptionKeysDlg(state).open(); }, () => { return !state.isAnonUser }), //

                // menuItem("Full Repository Export", "fullRepositoryExport", "
                // S.edit.fullRepositoryExport();") + //
            ]),

            new Menu("IPFS",
                [
                    new MenuItem("Display Node Info", () => S.view.runServerCommand("ipfsGetNodeInfo", state) ,
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) },
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) }
                    ),
                    new MenuItem("Force Refresh", () => {
                        let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
                        let nodeId: string = currentSelNode != null ? currentSelNode.id : null;
                        S.view.refreshTree(nodeId, false, nodeId, false, true, state);
                    },
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) },
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) }
                    ),
                ],
                () => { return state.isAdminUser; },
                () => { return state.isAdminUser; }),

            new Menu("Lucene",
                [
                    // new MenuItem("Run Test", () => {S.view.runServerCommand("luceneTest")},
                    //     () => { return state.isAdminUser },
                    //     () => { return state.isAdminUser }
                    // ),
                    new MenuItem("Refresh Index", () => S.view.runServerCommand("refreshLuceneIndex", state) ,
                        () => { return state.isAdminUser },
                        () => { return state.isAdminUser }
                    ),
                ],
                () => { return state.isAdminUser; },
                () => { return state.isAdminUser; }),

            new Menu("Admin",
                [
                    //new MenuItem("Graph Display Test", () => {S.view.graphDisplayTest()}, () => { return state.isAdminUser }, () => { return state.isAdminUser }), //
                    new MenuItem("Server Info", () => S.view.runServerCommand("getServerInfo", state) , () => { return state.isAdminUser }, () => { return state.isAdminUser }), //
                    new MenuItem("Compact DB", () => S.view.runServerCommand("compactDb", state) , () => { return state.isAdminUser }, () => { return state.isAdminUser }), //

                    new MenuItem("Backup DB", () =>  S.view.runServerCommand("BackupDb", state) , () => { return state.isAdminUser }, () => { return state.isAdminUser }), //
                    new MenuItem("Reset Public Node", () => S.view.runServerCommand("initializeAppContent", state) , () => { return state.isAdminUser }, () => { return state.isAdminUser }), //
                    new MenuItem("Insert Book: War and Peace", S.edit.insertBookWarAndPeace,
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) },
                        () => { return state.isAdminUser || (S.user.isTestUserAccount(state) && selNodeIsMine) }
                    ),

                    new MenuItem("Rebuild Indexes", () => S.meta64.rebuildIndexes(), () => { return state.isAdminUser }, () => { return state.isAdminUser }),
                    new MenuItem("Shutdown Server Node", () => S.meta64.shutdownServerNode(state), () => { return state.isAdminUser }, () => { return state.isAdminUser }),
                    new MenuItem("Send Test Email", () => S.meta64.sendTestEmail(state), () => { return state.isAdminUser }, () => { return state.isAdminUser }),
                    new MenuItem("Encryption Test", async () => {
                        await S.encryption.test();
                        S.util.showMessage("Encryption Test Complete. Check browser console for output.", "Note", true);
                    }, () => { return state.isAdminUser }, () => { return state.isAdminUser }),
                    new MenuItem("TTS Test", async () => {
                        let tts = window.speechSynthesis;
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

                    }, () => { return state.isAdminUser }, () => { return state.isAdminUser }),
                ],
                () => { return state.isAdminUser; },
                () => { return state.isAdminUser; })
        ]);
    }
}
