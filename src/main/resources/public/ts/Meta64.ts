import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { Constants as C } from "./Constants";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { Meta64Intf } from "./intf/Meta64Intf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { App } from "./widget/App";
import { CompIntf } from "./widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Meta64 implements Meta64Intf {

    app: CompIntf;
    navBarHeight: number = 0;
    appInitialized: boolean = false;
    curUrlPath: string = window.location.pathname + window.location.search;

    /* screen capabilities */
    deviceWidth: number = 0;
    deviceHeight: number = 0;
    parentIdToFocusNodeMap: { [key: string]: string } = {};
    curHighlightNodeCompRow: CompIntf = null;

    // Function cache: Creating NEW functions (like "let a = () => {...do something}"), is an expensive operation (performance) so we have this
    // cache to allow reuse of function definitions.
    private fc: { [key: string]: () => void } = {};
    private fcCount: number = 0;

    private static lastKeyDownTime: number = 0;

    /* We want to only be able to drag nodes by clicking on their TYPE ICON, and we accomplish that by using the mouseover/mouseout
    on those icons to detect an 'is mouse over' condition any time a drag attempt is started on a row and only allow it if mouse
    is over the icon */
    public draggableId: string = null;

    // use this to know how long to delay the refresh for breadrumbs should wait to keep from interrupting the fade effect
    // by doing which would happen if it rendered before the fade effect was complete. (see fadeInRowBkgClz)
    public fadeStartTime: number = 0;

    /* We save userName+password in these vars to pass in every request
    so that we can log back in again silently after any session timeout */
    userName: string;
    password: string;

    // maps the hash of an encrypted block of text to the unencrypted text, so that we never run the same
    // decryption code twice.
    decryptCache: { [key: string]: string } = {};

    /* Creates/Access a function that does operation 'name' on a node identified by 'id' */
    getNodeFunc = (func: (id: string) => void, op: string, id: string): () => void => {
        const k = op + "_" + id;
        if (!this.fc[k]) {
            this.fc[k] = function () { func(id); };

            /* we hold the count in a var since calculating manually requires an inefficient iteration */
            this.fcCount++;
        }
        return this.fc[k];
    }

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
        S.view.refreshTree(null, true, null, false, false, true, true, state);
    }

    selectTab = (tabName: string): void => {
        // let state = store.getState();

        /* if tab is already active no need to update state now

        SOME codepaths like (openNode) are currently relying on selectTab
        to cause the dispatch/update, even when tab isn't changing, so need
        to find all those before we can optimize here to ignore setting to same tab.
        */
        // if (state.activeTab==tabName) return;

        dispatch({
            type: "Action_SelectTab",
            update: (s: AppState): void => {
                s.activeTab = tabName;
            }
        });
    }

    getSelNodeUidsArray = (state: AppState): string[] => {
        const selArray: string[] = [];
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
        const selArray: string[] = [];

        if (!state.selectedNodes) {
            console.log("no selected nodes.");
        } else {
            console.log("selectedNode count: " + S.util.getPropertyCount(state.selectedNodes));
        }

        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            const node: J.NodeInfo = state.idToNodeMap[id];
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
        const ret: Object = {};
        const selArray: J.NodeInfo[] = this.getSelNodesArray(state);
        if (!selArray || selArray.length === 0) {
            const node = this.getHighlightedNode(state);
            if (node) {
                ret[node.id] = node;
                return ret;
            }
        }

        for (let i = 0; i < selArray.length; i++) {
            const id = selArray[i].id;
            ret[id] = selArray[i];
        }
        return ret;
    }

    /* Gets selected nodes as NodeInfo.java objects array */
    getSelNodesArray = (state: AppState): J.NodeInfo[] => {
        const selArray: J.NodeInfo[] = [];
        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            const node = state.idToNodeMap[id];
            if (node) {
                selArray.push(node);
            }
            return true;
        });
        return selArray;
    }

    clearSelNodes = (state: AppState) => {
        dispatch({
            type: "Action_ClearSelections",
            state,
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

    // note: this code is not currently in use
    updateNodeInfo = (node: J.NodeInfo) => {
        S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id,
            includeAcl: false,
            includeOwners: true
        }, (res: J.GetNodePrivilegesResponse) => {
            // this.updateNodeInfoResponse(res, node);
        });
    }

    getHighlightedNode = (state: AppState = null): J.NodeInfo => {
        state = appState(state);
        if (!state.node) return null;
        const id: string = S.meta64.parentIdToFocusNodeMap[state.node.id];
        if (id) {
            return state.idToNodeMap[id];
        }
        return null;
    }

    highlightRowById = (id: string, scroll: boolean, state: AppState): void => {
        let node: J.NodeInfo = state.idToNodeMap[id];

        /* If node now known, resort to taking the best, previous node we had */
        if (!node) {
            node = this.getHighlightedNode(state);
        }

        if (node) {
            this.highlightNode(node, scroll, state);
        } else {
            // if we can't find that node, best behvior is at least to scroll to top.
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

        if (!state.isAnonUser) {
            /* for best performance (user experience), do this async */
            setTimeout(() => {
                S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, state.node.id);
                S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, node.id);
            }, 250);
        }

        S.meta64.parentIdToFocusNodeMap[state.node.id] = node.id;

        if (scroll) {
            S.view.scrollToSelectedNode(state);
        }
    }

    /* Find node by looking everywhere we possibly can on local storage for it */
    findNodeById = (state: AppState, nodeId: string): J.NodeInfo => {
        // first look in normal tree map for main view.
        let node: J.NodeInfo = state.idToNodeMap[nodeId];

        if (!node) {
            node = state.feedResults.find(n => n.id === nodeId);
        }

        if (!node) {
            node = state.timelineResults.find(n => n.id === nodeId);
        }

        if (!node) {
            node = state.searchResults.find(n => n.id === nodeId);
        }
        return node;
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

    updateNodeMap = (node: J.NodeInfo, state: AppState): void => {
        if (!node) return;
        state.idToNodeMap[node.id] = node;

        // NOTE: only the getFeed call (Feed tab) will have items with some parents populated.
        if (node.parent) {
            state.idToNodeMap[node.parent.id] = node.parent;
        }

        if (node.children) {
            node.children.forEach(function (n) {
                this.updateNodeMap(n, state);
            }, this);
        }
    }

    getNodeByName = (node: J.NodeInfo, name: string, state: AppState): J.NodeInfo => {
        if (!node) return null;
        if (node.name === name) return node;

        if (node.children) {
            return state.node.children.find(node => node.name === name);
        }
        return null;
    }

    initApp = async (): Promise<void> => {

        return new Promise<void>(async (resolve, reject) => {
            console.log("initApp running.");

            const state: AppState = store.getState();
            state.pendingLocationHash = window.location.hash;
            S.plugin.initPlugins();

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
                if (object == null || typeof (object) === "undefined") {
                    return;
                }
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
                // console.log("POPSTATE: location: " + document.location + ", state: " + JSON.stringify(event.state));

                if (event.state && event.state.nodeId) {
                    S.view.refreshTree(event.state.nodeId, true, event.state.highlightId, false, false, true, true, store.getState());
                    this.selectTab("mainTab");
                }
            };

            // This is a cool way of letting CTRL+UP, CTRL+DOWN scroll to next node.
            // WARNING: even with tabIndex added none of the other DIVS react renders seem to be able to accept an onKeyDown event.
            // Todo: before enabling this need to make sure 1) the Main Tab is selected and 2) No Dialogs re Open, because this WILL
            // capture events going to dialogs / edit fields
            document.body.addEventListener("keydown", (event: KeyboardEvent) => {
                // console.log("keydown: " + event.code);
                let state: AppState = store.getState();
                // if (event.ctrlKey) {

                switch (event.code) {
                    case "Escape":
                        if (S.meta64.fullscreenViewerActive(state)) {
                            S.nav.closeFullScreenImgViewer(state);
                        }

                        break;

                    // case "ArrowDown":
                    //     if (this.keyDebounce()) return;
                    //     state = store.getState();
                    //     S.view.scrollRelativeToNode("down", state);
                    //     break;

                    // case "ArrowUp":
                    //     if (this.keyDebounce()) return;
                    //     state = store.getState();
                    //     S.view.scrollRelativeToNode("up", state);
                    //     break;

                    case "ArrowLeft":
                        if (this.keyDebounce()) return;
                        // S.nav.navUpLevel();
                        if (state.fullScreenViewId) {
                            S.nav.prevFullScreenImgViewer(state);
                        }
                        break;

                    case "ArrowRight":
                        if (this.keyDebounce()) return;
                        state = store.getState();
                        // S.nav.navOpenSelectedNode(state);
                        if (state.fullScreenViewId) {
                            S.nav.nextFullScreenImgViewer(state);
                        }
                        break;

                    default: break;
                }
                // }
            });

            if (this.appInitialized) {
                return;
            }

            this.appInitialized = true;

            S.props.initConstants();
            this.displaySignupMessage();

            /*
             * $ (window).on("orientationchange", _.orientationHandler);
             */

            window.addEventListener("resize", () => {
                this.deviceWidth = window.innerWidth;
                this.deviceHeight = window.innerHeight;
            });

            // todo-1: actually this is a nuisance unless user is actually EDITING a node right now
            // so until i make it able to detect if user is editing i'm removing this.
            // window.onbeforeunload = () => {
            //     return "Leave Quanta ?";
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

            // This is the root react App component that contains the entire application
            this.app = new App(); // new AppDemo
            this.app.updateDOM(store, "app");

            /*
             * This call checks the server to see if we have a session already, and gets back the login information from
             * the session, and then renders page content, after that.
             */

            // this.pingServer();
            S.user.refreshLogin(store.getState());

            S.util.initProgressMonitor();
            this.processUrlParams(null);

            this.setOverlay(false);

            // todo-1: could replace this pull with a push.
            setTimeout(() => {
                S.view.displayNotifications(null, store.getState());
            }, 1000);

            setTimeout(() => {
                S.encryption.initKeys();
            }, 2000);

            // todo-1: could replace this pull with a push.
            setTimeout(() => {
                this.maintenanceCycle();
            }, 30000);

            // Initialize the 'ServerPush' client-side connection
            S.push.init();

            console.log("initApp complete.");
            resolve();
        });
    }

    keyDebounce = () => {
        const now = S.util.currentTimeMillis();
        // allow one operation every quarter second.
        if (Meta64.lastKeyDownTime > 0 && now - Meta64.lastKeyDownTime < 250) {
            return true;
        }
        Meta64.lastKeyDownTime = now;
        return false;
    }

    maintenanceCycle = () => {
        // console.log("Maintenance fcCount: "+this.fcCount);
        /* Clean out function referenes after a threshold is reached */
        if (this.fcCount > 500) {
            this.fc = {};
            this.fcCount = 0;
        }
    }

    /* The overlayCounter allows recursive operations which show/hide the overlay
    to happen such that if something has already shown the overlay and not hidden it yet, then
    any number of 'sub-processes' (functionality) cannot distrupt the proper state. This is just
    the standard sort of 'reference counting' sort of algo here. Note that we initialize
    the counter to '1' and not zero since the overlay is initially visible so that's the correct
    counter state to start with.
    */
    static overlayCounter: number = 1; // this starting value is important.
    setOverlay = (showOverlay: boolean) => {

        Meta64.overlayCounter += showOverlay ? 1 : -1;
        // console.log("overlayCounter=" + Meta64.overlayCounter);

        /* if overlayCounter goes negative, that's a mismatch */
        if (Meta64.overlayCounter < 0) {
            throw new Error("Overlay calls are mismatched");
        }

        if (Meta64.overlayCounter === 1) {

            /* Whenever we are about to show the overlay always give the app 0.7 seconds before showing the overlay in case
            the app did something real fast and the display of the overlay would have just been a wasted annoyance (visually)
            and just simply caused a bit of unnecessary eye strain
            */
            setTimeout(() => {
                // after the timer we check for the counter still being greater than zero (not an ==1 this time).
                if (Meta64.overlayCounter > 0) {
                    // console.log("showing overlay.");
                    const elm = S.util.domElm("overlayDiv");
                    if (elm) {
                        elm.style.display = "block";
                        elm.style.cursor = "wait";
                    }
                }
            }, 1200);
        }
        else if (Meta64.overlayCounter === 0) {
            // console.log("hiding overlay.");
            const elm = S.util.domElm("overlayDiv");
            if (elm) {
                elm.style.display = "none";
            }
        }
        // console.log("overlayCounter="+Meta64.overlayCounter);
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
                new ChangePasswordDlg(passCode, state).open();
            }, 100);
        }
    }

    displaySignupMessage = (): void => {
        const signupElm = S.util.domElm("signupCodeResponse");
        if (signupElm) {
            const signupResponse = signupElm.textContent;
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
        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad", null,
            (res: J.RenderNodeResponse): void => {
                if (!res.success || res.exceptionType === "auth") {
                    S.util.showMessage("Unable to access the requested page without being logged in. Try loading the URL without parameters, or log in.", "Warning");
                }
                S.render.renderPageFromData(res, false, null, true, true, state);
            }
        );
    }

    saveUserPreferences = (state: AppState): void => {
        S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
            userPreferences: state.userPreferences
        });
    }

    openSystemFile = (fileName: string) => {
        S.util.ajax<J.OpenSystemFileRequest, J.OpenSystemFileResponse>("openSystemFile", {
            fileName
        });
    }

    setStateVarsUsingLoginResponse = (res: J.LoginResponse, state: AppState): void => {
        if (!res || !state) return;
        if (res.rootNode) {
            state.homeNodeId = res.rootNode;
            state.homeNodePath = res.rootNodePath;
        }
        state.userName = res.userName;
        state.isAdminUser = res.userName === "admin";
        state.isAnonUser = res.userName === J.PrincipalName.ANON;

        // bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
        // sure i'm keeping this feature.
        state.allowBashScripting = false;

        state.anonUserLandingPageNode = res.anonUserLandingPageNode;
        state.allowFileSystemSearch = res.allowFileSystemSearch;

        state.userPreferences = res.userPreferences;

        var title;
        if (!state.isAnonUser) {
            title = res.userName + "@Quanta";
        }
        else {
            title = "Quanta";
        }

        dispatch({
            type: "Action_LoginResponse",
            state,
            update: (s: AppState): void => {
                s.title = title;
            }
        });
    }

    // todo-1: need to decide if I want this. It's disabled currently (not called)
    removeRedundantFeedItems = (feedResults: J.NodeInfo[]): J.NodeInfo[] => {
        if (!feedResults || feedResults.length === 0) return feedResults;

        // first build teh set of ids that that are in 'ni.parent.id'
        const idSet: Set<string> = new Set<string>();
        feedResults.forEach((ni: J.NodeInfo) => {
            if (ni.parent) {
                idSet.add(ni.parent.id);
            }
        });

        // now return filtered list only for items where 'id' is not in the set above.
        return feedResults.filter(ni => !idSet.has(ni.id));
    }

    fullscreenViewerActive = (state: AppState): boolean => {
        return !!(state.fullScreenViewId || state.fullScreenGraphId || state.fullScreenCalendarId);
    }
}
