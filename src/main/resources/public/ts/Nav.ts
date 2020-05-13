import * as J from "./JavaIntf";
import { NavIntf } from "./intf/NavIntf";
import { LoginDlg } from "./dlg/LoginDlg";
import { PrefsDlg } from "./dlg/PrefsDlg";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { VerticalLayout } from "./widget/VerticalLayout";
import { Anchor } from "./widget/Anchor";
import { Heading } from "./widget/Heading";
import { MainMenuPopupDlg } from "./dlg/MainMenuPopupDlg";
import { DialogBaseImpl } from "./DialogBaseImpl";
import { AppState } from "./AppState";
import { dispatch } from "./AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Nav implements NavIntf {

    _UID_ROWID_PREFIX: string = "row_";
    mainMenuPopupDlg: DialogBaseImpl;

    /* todo-2: eventually when we do paging for other lists, we will need a set of these variables for each list display (i.e. search, timeline, etc) */
    mainOffset: number = 0;

    /* todo-2: need to have this value passed from server rather than coded in TypeScript, however for now 
    this MUST match RenderNodeService.ROWS_PER_PAGE in Java on server. */
    ROWS_PER_PAGE: number = 25;

    login = (state: AppState): void => {
        let dlg = new LoginDlg(null, state);
        dlg.populateFromLocalDb();
        dlg.open();
    }

    logout = (state: AppState): void => {
        S.user.logout(true, state);
    }

    signup = (state: AppState): void => {
        S.user.openSignupPg(state);
    }

    preferences = (state: AppState): void => {
        new PrefsDlg(state).open();
    }

    displayingRepositoryRoot = (state: AppState): boolean => {
        if (!state.node) return false;
        //one way to detect repository root (without path, since we don't send paths back to client) is as the only node that owns itself.
        //console.log(S.util.prettyPrint(S.meta64.currentNodeData.node));
        return state.node.id == state.node.ownerId;
    }

    displayingHome = (state: AppState): boolean => {
        if (!state.node) return false;
        if (state.isAnonUser) {
            return state.node.id === state.anonUserLandingPageNode;
        } else {
            return state.node.id === state.homeNodeId;
        }
    }

    parentVisibleToUser = (state: AppState): boolean => {
        return !this.displayingHome(state);
    }

    upLevelResponse = (res: J.RenderNodeResponse, id: string, scrollToTop: boolean, state: AppState): void => {
        if (!res || !res.node) {
            S.util.showMessage("No data is visible to you above this node.", "Warning");
        } else {
            S.render.renderPageFromData(res, scrollToTop, id, true, state);
        }
    }

    navOpenSelectedNode = (state: AppState): void => {
        let currentSelNode: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!currentSelNode) return;
        S.nav.openNodeById(currentSelNode.id, state);
    }

    navToSibling = (siblingOffset: number, state: AppState): void => {
        if (!state.node) return null;

        this.mainOffset = 0;
        let res = S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: null,
            siblingOffset: siblingOffset,
            renderParentIfLeaf: true,
            offset: this.mainOffset,
            goToLastPage: false,
            forceIPFSRefresh: false
        },
            //success callback
            (res: J.RenderNodeResponse) => {
                this.upLevelResponse(res, null, true, state);
            }
            ,
            //fail callback
            (res: string) => {
                this.navHome(state);
            });
    }

    navUpLevel = (state: AppState): void => {
        if (!state.node) return null;

        //Always just scroll to the top before doing an actual 'upLevel' to parent.
        if (S.view.docElm.scrollTop > 100) {
            S.view.docElm.scrollTop = 0;

            /* This works fine but actually for me causes eye-strain. I might enable this for mobile some day, but for now
            let's just comment it out. */
            //S.util.animateScrollToTop();

            S.meta64.highlightNode(state.node, false, state);
            return;
        }

        if (!this.parentVisibleToUser(state)) {
            // Already at root. Can't go up.
            return;
        }

        this.mainOffset = 0;
        let res = S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: state.node.id,
            upLevel: 1,
            siblingOffset: 0,
            renderParentIfLeaf: false,
            offset: this.mainOffset,
            goToLastPage: false,
            forceIPFSRefresh: false
        },
            //success callback
            (res: J.RenderNodeResponse) => {
                this.upLevelResponse(res, state.node.id, false, state);
            }
            ,
            //fail callback
            (res: string) => {
                this.navHome(state);
            });
    }

    /*
     * turn of row selection DOM element of whatever row is currently selected
     */
    getSelectedDomElement = (state: AppState): HTMLElement => {
        var currentSelNode = S.meta64.getHighlightedNode(state);
        if (currentSelNode) {

            /* get node by node identifier */
            let node: J.NodeInfo = state.idToNodeMap[currentSelNode.id];

            if (node) {
                //console.log("found highlighted node.id=" + node.id);

                /* now make CSS id from node */
                let nodeId: string = this._UID_ROWID_PREFIX + node.id;
                // console.log("looking up using element id: "+nodeId);

                return S.util.domElm(nodeId);
            }
        }

        return null;
    }

    clickOnNodeRow = (node: J.NodeInfo, state: AppState): void => {
        console.log("clickOnNodeRow: id=" + node.id);

        /* First check if this node is already highlighted and if so just return */
        let highlightNode = S.meta64.getHighlightedNode(state);
        if (highlightNode && highlightNode.id == node.id) {
            return;
        }

        /*
         * sets which node is selected on this page (i.e. parent node of this page being the 'key')
         */
        S.meta64.highlightNode(node, false, state);

        /* We do this async just to make the fastest possible response when clicking on a node */
        setTimeout(() => {
            S.util.updateHistory(null, node, state);
        }, 250);

        dispatch({
            type: "Action_ClickOnNodeRow",
            updateNew: (s: AppState): AppState => {
                return { ...state };
            }
        });
    }

    openContentNode = (nodePathOrId: string, state: AppState): void => {
        this.mainOffset = 0;
        console.log("openContentNode()");
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
            nodeId: nodePathOrId,
            upLevel: null,
            siblingOffset: 0,
            renderParentIfLeaf: null,
            offset: this.mainOffset,
            goToLastPage: false,
            forceIPFSRefresh: false
        }, (res) => { this.navPageNodeResponse(res, state); });
    }

    openNodeById = (id: string, state: AppState): void => {
        let node: J.NodeInfo = state.idToNodeMap[id];
        S.meta64.highlightNode(node, false, state);

        if (!node) {
            S.util.showMessage("Unknown nodeId in openNodeByUid: " + id, "Warning");
        } else {
            S.view.refreshTree(node.id, true, null, false, false, state);
        }
    }

    toggleNodeSel = (selected: boolean, id: string, state: AppState): void => {
        if (selected) {
            state.selectedNodes[id] = true;
        } else {
            delete state.selectedNodes[id];
        }
    }

    navPageNodeResponse = (res: J.RenderNodeResponse, state: AppState): void => {
        console.log("navPageNodeResponse.");
        S.meta64.clearSelNodes(state);
        S.render.renderPageFromData(res, true, null, true, state);
    }

    geoLocation = (state: AppState): void => {
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
                    ]), false, 0, state
                ).open();
            });
        }
        else {
            new MessageDlg("GeoLocation is not available on this device.", "Message", null, null, false, 0, state).open();
        }
    }

    showMainMenu = (state: AppState): void => {
        this.mainMenuPopupDlg = new MainMenuPopupDlg(state);
        this.mainMenuPopupDlg.open("inline-block");
    }

    navHome = (state: AppState): void => {
        console.log("navHome()");
        if (state.isAnonUser) {
            S.meta64.loadAnonPageHome(state);
        } else {
            this.mainOffset = 0;
            S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: state.homeNodeId,
                upLevel: null,
                siblingOffset: 0,
                renderParentIfLeaf: null,
                offset: this.mainOffset,
                goToLastPage: false,
                forceIPFSRefresh: false
            }, (res) => { this.navPageNodeResponse(res, state); });
        }
    }

    navPublicHome = (state: AppState): void => {
        S.meta64.loadAnonPageHome(state);
    }
}

