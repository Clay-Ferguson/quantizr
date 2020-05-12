import * as J from "./JavaIntf";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { Meta64Intf } from "./intf/Meta64Intf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { App } from "./widget/App";
import { AppState } from "./AppState";
import { MainTabPanelIntf } from "./Interfaces";
import { dispatch, initialState } from "./AppRedux";
import { store } from "./AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Meta64 implements Meta64Intf {

    mainTabPanel: MainTabPanelIntf;
    app: App;

    navBarHeight: number = 0;

    appInitialized: boolean = false;
    isMobile: boolean;
    isMobileOrTablet: boolean;

    curUrlPath: string = window.location.pathname + window.location.search;

    /* screen capabilities */
    deviceWidth: number = 0;
    deviceHeight: number = 0;

    rebuildIndexes = (): void => {
        S.util.ajax<J.RebuildIndexesRequest, J.RebuildIndexesResponse>("rebuildIndexes", {}, function (res: J.RebuildIndexesResponse) {
            S.util.showMessage("Index rebuild complete.", "Note");
        });
    }

    shutdownServerNode = (): void => {
        S.util.ajax<J.ShutdownServerNodeRequest, J.ShutdownServerNodeResponse>("shutdownServerNode", {}, function (res: J.ShutdownServerNodeResponse) {
            S.util.showMessage("Server Node Shutdown initiated.", "Note");
        });
    }

    sendTestEmail = (): void => {
        S.util.ajax<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail", {}, function (res: J.SendTestEmailResponse) {
            S.util.showMessage("Send Test Email Initiated.", "Note");
        });
    }

    refresh = (state: AppState): void => {
        S.view.refreshTree(null, true, null, false, false, state);
    }

    selectTab = (tabName: string): void => {
        dispatch({
            type: "Action_SelectTab",
            update: (s: AppState): void => {
                s.activeTab = tabName;
            }
        });
    }

    getSelNodeUidsArray = (state: AppState): string[] => {
        let selArray: string[] = [];
        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            selArray.push(id);
            return true;
        });
        return selArray;
    }

    /**
    Returns a new array of all the selected nodes each time it's called.
    */
    getSelNodeIdsArray = (state: AppState): string[] => {
        let selArray: string[] = [];

        if (!state.selectedNodes) {
            console.log("no selected nodes.");
        } else {
            console.log("selectedNode count: " + S.util.getPropertyCount(state.selectedNodes));
        }

        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            let node: J.NodeInfo = state.idToNodeMap[id];
            if (!node) {
                console.log("unable to find idToNodeMap for id=" + id);
            } else {
                selArray.push(node.id);
            }
            return true;
        });
        return selArray;
    }

    /* return an object with properties for each NodeInfo where the key is the id */
    getSelNodesAsMapById = (state: AppState): Object => {
        let ret: Object = {};
        let selArray: J.NodeInfo[] = this.getSelNodesArray(state);
        if (!selArray || selArray.length == 0) {
            let node = this.getHighlightedNode(state);
            if (node) {
                ret[node.id] = node;
                return ret;
            }
        }

        for (let i = 0; i < selArray.length; i++) {
            let id = selArray[i].id;
            ret[id] = selArray[i];
        }
        return ret;
    }

    /* Gets selected nodes as NodeInfo.java objects array */
    getSelNodesArray = (state: AppState): J.NodeInfo[] => {
        let selArray: J.NodeInfo[] = [];
        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            let node = state.idToNodeMap[id];
            if (node) {
                selArray.push(node);
            }
            return true;
        });
        return selArray;
    }

    clearSelNodes = (state: AppState) => {
        dispatch({
            type: "Action_ClearSelections", state,
            update: (s: AppState): void => {
                s.selectedNodes = {};
            }
        });
    }

    selectAllNodes = (nodeIds: string[]) => {
        // DO NOT DELETE (feature work in progress)
        // //todo-1: large numbers of selected nodes isn't going to scale well in this design
        // // but i am not letting perfection be the enemy of good here (yet)
        // this.selectedNodes = {};
        // nodeIds.forEach( (nodeId, index) => {
        //     this.selectedNodes[nodeId] = true;
        // });
    }

    //note: this code is not currently in use
    updateNodeInfo = (node: J.NodeInfo) => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id,
            includeAcl: false,
            includeOwners: true
        }, (res: J.GetNodePrivilegesResponse) => {
            //this.updateNodeInfoResponse(res, node);
        });
    }

    getHighlightedNode = (state: AppState): J.NodeInfo => {
        if (!state.node) return null;
        let ret: J.NodeInfo = state.parentIdToFocusNodeMap[state.node.id];
        return ret;
    }

    highlightRowById = (id: string, scroll: boolean, state: AppState): void => {

        let node: J.NodeInfo = state.idToNodeMap[id];
        if (node) {
            this.highlightNode(node, scroll, state);
        } else {
            //if we can't find that node, best behvior is at least to scroll to top.
            if (scroll) {
                S.view.scrollToTop();
            }
            console.log("highlightRowById failed to find id: " + id);
        }
    }

    highlightNode = (node: J.NodeInfo, scroll: boolean, state: AppState): void => {
        if (!node || !state.node) {
            return;
        }

        let id = state.node.id;
        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, id);
        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, node.id);

        state.parentIdToFocusNodeMap[id] = node;

        if (scroll) {
            S.view.scrollToSelectedNode(state);
        }
    }

    /* WARNING: This is NOT the highlighted node. This is whatever node has the CHECKBOX selection */
    getSingleSelectedNode = (state: AppState): J.NodeInfo => {
        let ret = null;
        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            ret = state.idToNodeMap[id];
            return false;
        });
        return ret;
    }

    getOrdinalOfNode = (node: J.NodeInfo, state: AppState): number => {
        let ret = -1;

        if (!node || !state.node || !state.node.children)
            return ret;

        let idx = -1;
        state.node.children.forEach((iterNode): boolean => {
            idx++;
            if (node.id === iterNode.id) {
                ret = idx;
                return false; //stop iterating.
            }
            return true;
        });
        return ret;
    }

    removeBinaryById = (id: string, state: AppState): void => {
        if (!state.node) return;
        state.node.children.forEach((node: J.NodeInfo) => {
            if (node.id === id) {
                S.props.deleteProp(node, J.NodeProp.BIN_MIME);
            }
        });
    }

    updateNodeMap = (node: J.NodeInfo, level: number, state: AppState): void => {
        if (!node) return;

        if (level == 1) {
            state.idToNodeMap = {};
        }
        state.idToNodeMap[node.id] = node;

        if (node.children) {
            node.children.forEach(n => this.updateNodeMap(n, level+1, state));
        }
    }

    /**
    * Detect if browser is a mobile (something smaller than tabled)
    * 
    * from: https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
    */
    mobileCheck = (): boolean => {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || (window as any).opera);
        return check;
    }

    /**
     * Same check as above but includes tablets
     */
    mobileOrTabletCheck = (): boolean => {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || (window as any).opera);
        return check;
    }

    initApp = async (): Promise<void> => {

        return new Promise<void>(async (resolve, reject) => {
            console.log("initApp running.");

            let state: AppState = store.getState();
            state.pendingLocationHash = window.location.hash;
            S.plugin.initPlugins();

            this.isMobile = this.mobileCheck();
            this.isMobileOrTablet = this.mobileOrTabletCheck();

            // If you want to test out 'mobile' rendering, you can simply set isMobile to true here, and of course size your browser real small
            //this.isMobile = true;

            // SystemFolder and File handling stuff is disabled for now (todo-1), but will eventually be brought
            // back as a plugin similar to rssPlugin, coreTypesPlugin, etc. Also the new way of doing this
            // rendering and property ordering is what's being done in BashPlugin and CoreTypesPlugin via TypeHandlers so refer
            // to that when you ever bring back these types.
            //
            // this.renderFunctionsByType["meta64:systemfolder"] = systemfolder.renderNode;
            // this.propOrderingFunctionsByType["meta64:systemfolder"] = systemfolder.propOrdering;
            //
            // this.renderFunctionsByType["meta64:filelist"] = systemfolder.renderFileListNode;
            // this.propOrderingFunctionsByType["meta64:filelist"] = systemfolder.fileListPropOrdering;

            (window as any).addEvent = (object: any, type: any, callback: any) => {
                if (object == null || typeof (object) == 'undefined')
                    return;
                if (object.addEventListener) {
                    object.addEventListener(type, callback, false);
                } else if (object.attachEvent) {
                    object.attachEvent("on" + type, callback);
                } else {
                    object["on" + type] = callback;
                }
            };

            // leaving for future reference. Currently not needed.
            // window.onhashchange = function (e) {
            // }

            /* 
            NOTE: This works in conjunction with pushState, and is part of what it takes to make the back button (browser hisotry) work
            in the context of SPAs
            */
            window.onpopstate = (event) => {
                //console.log("POPSTATE: location: " + document.location + ", state: " + JSON.stringify(event.state));

                if (event.state && event.state.nodeId) {
                    S.view.refreshTree(event.state.nodeId, true, event.state.highlightId, false, false, store.getState());
                    this.selectTab("mainTab");
                }
            };

            document.body.addEventListener("keydown", (event: KeyboardEvent) => {

                let state = store.getState();

                if (event.ctrlKey) {
                    switch (event.code) {
                        case "ArrowDown":
                            this.selectTab("mainTab");
                            S.view.scrollRelativeToNode("down", state);
                            break;

                        case "ArrowUp":
                            this.selectTab("mainTab");
                            S.view.scrollRelativeToNode("up", state);
                            break;

                        case "ArrowLeft":
                            this.selectTab("mainTab");
                            S.nav.navUpLevel(state);
                            break;

                        case "ArrowRight":
                            this.selectTab("mainTab");
                            S.nav.navOpenSelectedNode(state);
                            break;

                        default: break;
                    }
                }
            });

            if (this.appInitialized)
                return;

            this.appInitialized = true;

            S.props.initConstants();
            this.displaySignupMessage();

            /*
             * $ (window).on("orientationchange", _.orientationHandler);
             */

            // todo-1: actually this is a nuisance unless user is actually EDITING a node right now
            // so until i make it able to detect if user is editing i'm removing this.
            // window.onbeforeunload = () => {
            //     return "Leave Quantizr ?";
            // };

            /*
             * I thought this was a good idea, but actually it destroys the session, when the user is entering an
             * "id=\my\path" type of url to open a specific node. Need to rethink  Basically for now I'm thinking
             * going to a different url shouldn't blow up the session, which is what 'logout' does.
             *
             * $ (window).on("unload", function() { user.logout(false); });
             */

            this.deviceWidth = window.innerWidth;
            this.deviceHeight = window.innerHeight;

            //This is the root react App component that contains the entire application
            this.app = new App();
            this.app.updateDOM(store, "app");

            /*
             * This call checks the server to see if we have a session already, and gets back the login information from
             * the session, and then renders page content, after that.
             */

            //this.pingServer();
            S.user.refreshLogin(store.getState());

            S.util.initProgressMonitor();
            this.processUrlParams(null);

            this.setOverlay(false);

            // todo-1: could replace this pull with a push.
            setTimeout(() => {
                S.view.displayNotifications(null, store.getState());
            }, 1000);

            // Initialize the 'ServerPush' client-side connection
            S.push.init();

            console.log("initApp complete.");
            resolve();
        });
    }

    /* The overlayCounter allows recursive operations which show/hide the overlay
    to happen such that if something has already shown the overlay and not hidden it yet, then 
    any number of 'sub-processes' (functionality) cannot distrupt the proper state. This is just
    the standard sort of 'reference counting' sort of algo here. Note that we initialize
    the counter to '1' and not zero since the overlay is initially visible so that's the correct
    counter state to start with.
    */
    static overlayCounter: number = 1; //this starting value is important.
    setOverlay = (showOverlay: boolean) => {

        Meta64.overlayCounter += showOverlay ? 1 : -1;
        //console.log("overlayCounter=" + Meta64.overlayCounter);

        /* if overlayCounter goes negative, that's a mismatch */
        if (Meta64.overlayCounter < 0) {
            throw new Error("Overlay calls are mismatched");
        }

        if (Meta64.overlayCounter == 1) {

            /* Whenever we are about to show the overlay always give the app 0.7 seconds before showing the overlay in case
            the app did something real fast and the display of the overlay would have just been a wasted annoyance (visually)
            and just simply caused a bit of unnecessary eye strain
            */
            setTimeout(() => {
                //after the timer we check for the counter still being greater than zero (not an ==1 this time).
                if (Meta64.overlayCounter > 0) {
                    //console.log("showing overlay.");
                    let elm = S.util.domElm("overlayDiv");
                    if (elm) {
                        elm.style.display = "block";
                        elm.style.cursor = "wait";
                    }
                }
            }, 1200);
        }
        else if (Meta64.overlayCounter == 0) {
            //console.log("hiding overlay.");
            let elm = S.util.domElm("overlayDiv");
            if (elm) {
                elm.style.display = "none";
            }
        }
        //console.log("overlayCounter="+Meta64.overlayCounter);
    }

    pingServer = () => {
        S.util.ajax<J.PingRequest, J.PingResponse>("ping", {},
            (res: J.PingResponse) => {
                console.log("Server Info: " + res.serverInfo);
            });
    }

    processUrlParams = (state: AppState): void => {
        var passCode = S.util.getParameterByName("passCode");
        if (passCode) {
            setTimeout(() => {
                new ChangePasswordDlg({ "passCode": passCode }, state).open();
            }, 100);
        }
    }

    displaySignupMessage = (): void => {
        let signupElm = S.util.domElm("signupCodeResponse");
        if (signupElm) {
            let signupResponse = signupElm.textContent;
            if (signupResponse === "ok") {
                S.util.showMessage("Signup complete.", "Note");
            }
        }
    }

    //
    // /* Don't need this method yet, and haven't tested to see if works */
    // orientationHandler = function(event): void {
    //     // if (event.orientation) {
    //     // if (event.orientation === 'portrait') {
    //     // } else if (event.orientation === 'landscape') {
    //     // }
    //     // }
    // }
    //

    loadAnonPageHome = (state: AppState): void => {
        console.log("loadAnonPageHome()");
        S.util.ajax<J.AnonPageLoadRequest, J.AnonPageLoadResponse>("anonPageLoad", {
        },
            (res: J.AnonPageLoadResponse): void => {
                S.render.renderPageFromData(res.renderNodeResponse, false, null, true, state);
            }
        );
    }

    saveUserPreferences = (state: AppState): void => {
        S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
            "userPreferences": state.userPreferences
        });
    }

    openSystemFile = (fileName: string) => {
        S.util.ajax<J.OpenSystemFileRequest, J.OpenSystemFileResponse>("openSystemFile", {
            fileName
        });
    }

    setStateVarsUsingLoginResponse = (res: J.LoginResponse, state: AppState): void => {
        if (res.rootNode) {
            state.homeNodeId = res.rootNode;
            state.homeNodePath = res.rootNodePath;
        }
        state.userName = res.userName;
        state.isAdminUser = res.userName === "admin";
        state.isAnonUser = res.userName === J.PrincipalName.ANON;

        //bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
        //sure i'm keeping this feature.
        state.allowBashScripting = false; // res.userName === "admin";

        state.anonUserLandingPageNode = res.anonUserLandingPageNode;
        state.allowFileSystemSearch = res.allowFileSystemSearch;

        state.userPreferences = res.userPreferences;

        //todo-1: admin user had bug where it wasn't loading this at login, so i did this hack for now to make admin logins
        //always set to what settings i prefer.
        if (state.isAdminUser) {
            state.showMetaData = false;
        }
        else {
            state.showMetaData = res.userPreferences.showMetaData;
        }

        var title = "";
        if (!state.isAnonUser) {
            title += "User: " + res.userName;
        }

        dispatch({
            type: "Action_LoginResponse", state,
            update: (s: AppState): void => {
                s.title = title;
            }
        });
    }
}
