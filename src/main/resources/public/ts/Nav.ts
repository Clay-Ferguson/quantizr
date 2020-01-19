import * as I from "./Interfaces";
import { NavIntf } from "./intf/NavIntf";
import { LoginDlg } from "./dlg/LoginDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { SearchContentDlg } from "./dlg/SearchContentDlg";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { VerticalLayout } from "./widget/VerticalLayout";
import { Anchor } from "./widget/Anchor";
import { Heading } from "./widget/Heading";
import { MainMenuPopupDlg } from "./dlg/MainMenuPopupDlg";
import { CompIntf } from "./widget/base/CompIntf";
import { DialogBaseImpl } from "./DialogBaseImpl";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Nav implements NavIntf {

    _UID_ROWID_PREFIX: string = "row_";
    mainMenuPopupDlg: DialogBaseImpl;
    mainNavPanel: CompIntf;

    /* todo-2: eventually when we do paging for other lists, we will need a set of these variables for each list display (i.e. search, timeline, etc) */
    mainOffset: number = 0;
    endReached: boolean = true;

    /* todo-2: need to have this value passed from server rather than coded in TypeScript, however for now 
    this MUST match RenderNodeService.ROWS_PER_PAGE in Java on server. */
    ROWS_PER_PAGE: number = 25;

    search = (): void => {
        new SearchContentDlg().open();
    }

    editMode = (): void => {
        S.edit.editMode();
    }

    login = (): void => {
        let dlg = new LoginDlg(null);
        dlg.populateFromLocalDb();
        dlg.open();
    }

    logout = (): void => {
        S.user.logout(true);
    }

    signup = (): void => {
        S.user.openSignupPg();
    }

    preferences = (): void => {
        new PrefsDlg().open();
    }

    openContentNode = (nodePathOrId: string): void => {
        this.mainOffset = 0;
        S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": nodePathOrId,
            "upLevel": null,
            "siblingOffset": 0,
            "renderParentIfLeaf": null,
            "offset": this.mainOffset,
            "goToLastPage": false
        }, this.navPageNodeResponse);
    }

    openGitHubSite = (): void => {
        window.open("http://github.com/Clay-Ferguson/quantizr.com", "_blank");
    }

    displayingHome = (): boolean => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node) return false;
        if (S.meta64.isAnonUser) {
            return S.meta64.currentNodeData.node.id === S.meta64.anonUserLandingPageNode;
        } else {
            return S.meta64.currentNodeData.node.id === S.meta64.homeNodeId;
        }
    }

    parentVisibleToUser = (): boolean => {
        return !this.displayingHome();
    }

    upLevelResponse = async (res: I.RenderNodeResponse, id: string): Promise<void> => {
        if (!res || !res.node) {
            S.util.showMessage("No data is visible to you above this node.");
        } else {
            await S.render.renderPageFromData(res, false, id);
        }
    }

    navOpenSelectedNode = (): void => {
        let currentSelNode: I.NodeInfo = S.meta64.getHighlightedNode();
        if (!currentSelNode) return;
        S.nav.openNode(currentSelNode.uid, true);
    }

    navToSibling = (siblingOffset: number): void => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node) return null;
        if (!this.parentVisibleToUser()) {
            // Already at root. Can't go up.
            return;
        }

        this.mainOffset = 0;
        var ironRes = S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": S.meta64.currentNodeData.node.id,
            "upLevel": null,
            "siblingOffset": siblingOffset,
            "renderParentIfLeaf": true,
            "offset": this.mainOffset,
            "goToLastPage": false
        }, 
        //success callback
        (res: I.RenderNodeResponse) => {
            this.upLevelResponse(res, S.meta64.currentNodeData.node.id);
        }
        , 
        //fail callback
        (res: string) => {
           this.navHome();
        });
    }


    navUpLevel = (): void => {
        if (!S.meta64.currentNodeData || !S.meta64.currentNodeData.node) return null;
        if (!this.parentVisibleToUser()) {
            // Already at root. Can't go up.
            return;
        }

        this.mainOffset = 0;
        var ironRes = S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
            "nodeId": S.meta64.currentNodeData.node.id,
            "upLevel": 1,
            "siblingOffset": 0,
            "renderParentIfLeaf": false,
            "offset": this.mainOffset,
            "goToLastPage": false
        }, 
        //success callback
        (res: I.RenderNodeResponse) => {
            this.upLevelResponse(res, S.meta64.currentNodeData.node.id);
        }
        , 
        //fail callback
        (res: string) => {
           this.navHome();
        });
    }

    /*
     * turn of row selection DOM element of whatever row is currently selected
     */
    getSelectedDomElement = (): HTMLElement => {
        var currentSelNode = S.meta64.getHighlightedNode();
        if (currentSelNode) {

            /* get node by node identifier */
            let node: I.NodeInfo = S.meta64.uidToNodeMap[currentSelNode.uid];

            if (node) {
                //console.log("found highlighted node.id=" + node.id);

                /* now make CSS id from node */
                let nodeId: string = this._UID_ROWID_PREFIX + node.uid;
                // console.log("looking up using element id: "+nodeId);

                return S.util.domElm(nodeId);
            }
        }

        return null;
    }

    clickOnNodeRow = (uid: string): void => {
        //console.log("clickOnNodeRow: uid=" + uid);
        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (!node) {
            //console.log("clickOnNodeRow recieved uid that doesn't map to any node. uid=" + uid);
            return;
        }

        /*
         * sets which node is selected on this page (i.e. parent node of this page being the 'key')
         */
        S.meta64.highlightNode(node, false);

        if (S.meta64.userPreferences.editMode) {
            /*
             * if node.owner is currently null, that means we have not retrieved the owner from the server yet, but
             * if non-null it's already displaying and we do nothing.
             */
            if (!node.owner) {
                //console.log("calling updateNodeInfo");
                S.meta64.updateNodeInfo(node);
            }
        }
        S.meta64.refreshAllGuiEnablement();
    }

    openNode = (uid: string, scrollToFirstChild?: boolean): void => {
        let node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        S.meta64.highlightNode(node, false);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNode: " + uid);
        } else {
            S.view.refreshTree(node.id, true, null, false, false, scrollToFirstChild);
        }
    }

    toggleNodeSel = (selected: boolean, uid: string): void => {
        if (selected) {
            S.meta64.selectedNodes[uid] = true;
        } else {
            delete S.meta64.selectedNodes[uid];
        }

        S.view.updateStatusBar();
        S.meta64.refreshAllGuiEnablement();
    }

    navPageNodeResponse = async (res: I.RenderNodeResponse): Promise<void> => {
        console.log("navPageNodeResponse.");
        S.meta64.clearSelectedNodes();
        await S.render.renderPageFromData(res, true);
    }

    geoLocation = (): void => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((location) => {
                new MessageDlg("Message", "Title", null,
                    new VerticalLayout([
                        new Heading(3, "Lat:" + location.coords.latitude),
                        new Heading(3, "Lon:" + location.coords.longitude),
                        new Heading(4, "+/- " + location.coords.accuracy),
                        new Anchor("https://www.google.com/maps/search/?api=1&query=" + location.coords.latitude + "," + location.coords.longitude,
                            "Show Your Google Maps Location",
                            { "target": "_blank" }),
                    ])
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message").open();
        }
    }

    showMainMenu = (): void => {
        S.meta64.updateState();
        //todo-1: Note: currently S.meta64.refreshAllGuiEnablement has a tight coupling to this for enablement.
        this.mainMenuPopupDlg = new MainMenuPopupDlg();
        this.mainMenuPopupDlg.open("inline-block");
    }

    navHome = (): void => {
        if (S.meta64.isAnonUser) {
            S.meta64.loadAnonPageHome();
        } else {
            this.mainOffset = 0;
            S.util.ajax<I.RenderNodeRequest, I.RenderNodeResponse>("renderNode", {
                "nodeId": S.meta64.homeNodeId,
                "upLevel": null,
                "siblingOffset": 0,
                "renderParentIfLeaf": null,
                "offset": this.mainOffset,
                "goToLastPage": false
            }, this.navPageNodeResponse);
        }
    }

    navPublicHome = (): void => {
        S.meta64.loadAnonPageHome();
    }
}

