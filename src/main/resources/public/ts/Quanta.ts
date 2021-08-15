import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { OpenGraphPanel } from "./comps/OpenGraphPanel";
import { Constants as C } from "./Constants";
import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { FollowersRSInfo } from "./FollowersRSInfo";
import { FollowingRSInfo } from "./FollowingRSInfo";
import { QuantaIntf } from "./intf/QuantaIntf";
import { TabDataIntf } from "./intf/TabDataIntf";
import * as J from "./JavaIntf";
import { Log } from "./Log";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { PubSub } from "./PubSub";
import { ResultSetInfo } from "./ResultSetInfo";
import { SharesRSInfo } from "./SharesRSInfo";
import { Singletons } from "./Singletons";
import { FeedView } from "./tabs/FeedView";
import { FollowersResultSetView } from "./tabs/FollowersResultSetView";
import { FollowingResultSetView } from "./tabs/FollowingResultSetView";
import { MainTabComp } from "./tabs/MainTabComp";
import { SearchResultSetView } from "./tabs/SearchResultSetView";
import { ServerInfoView } from "./tabs/ServerInfoView";
import { SharedNodesResultSetView } from "./tabs/SharedNodesResultSetView";
import { TimelineResultSetView } from "./tabs/TimelineResultSetView";
import { TrendingView } from "./tabs/TrendingView";
import { TimelineRSInfo } from "./TimelineRSInfo";
import { TrendingRSInfo } from "./TrendingRSInfo";
import { App } from "./widget/App";
import { Comp } from "./widget/base/Comp";
import { CompIntf } from "./widget/base/CompIntf";
import { WelcomePanel } from "./widget/WelcomePanel";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Quanta implements QuantaIntf {
    config: any;
    mainMenu: MainMenuDlg;
    hiddenRenderingEnabled: boolean = true;
    noScrollToId: string = null;
    activeTab: string;

    newNodeTargetId: string;
    newNodeTargetOffset: number;

    app: CompIntf;
    appInitialized: boolean = false;
    curUrlPath: string = window.location.pathname + window.location.search;

    parentIdToFocusNodeMap: Map<string, string> = new Map<string, string>();
    curHighlightNodeCompRow: CompIntf = null;

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
    authToken: string;
    loggingOut: boolean;

    ctrlKey: boolean;
    ctrlKeyTime: number;

    // maps the hash of an encrypted block of text to the unencrypted text, so that we never run the same
    // decryption code twice.
    decryptCache: Map<string, string> = new Map<string, string>();

    /* Map of all URLs and the openGraph object retrieved for it */
    openGraphData: Map<string, J.OpenGraph> = new Map<string, J.OpenGraph>();

    /* Map of all OpenGraphPanels in top to bottom rendered order. Each instance of an OpenGraphPanel
    needs to somehow associate to an array like this that's TAB SPECIFIC (todo-1), and for now we
    just let this apply to the Feed tab */
    openGraphComps: OpenGraphPanel[] = [];

    nodeHistory: NodeHistoryItem[] = [];

    // 0 means we allow.
    allowGrowPage: number = 0;

    sendTestEmail = (): void => {
        S.util.ajax<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail", {}, function (res: J.SendTestEmailResponse) {
            S.util.showMessage("Send Test Email Initiated.", "Note");
        });
    }

    /* We call this to temporarily disable the autoscroll in times like when we just edited something and we
       don't want auto-scrolling interrupting us when we try to forcabily highlight and scroll to the node we just
       got done editing for example
       */
    tempDisableAutoScroll = (): void => {
        // inc ref counter
        S.quanta.allowGrowPage++;

        // wait a full 5 seconds before we allow the "more" button to ever
        // trigger any autoscrolling again.
        setTimeout(() => {
            // dec ref counter
            S.quanta.allowGrowPage--;
        }, 3000);
    }

    showSystemNotification = (title: string, message: string): void => {
        if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission(function (status) { // status is "granted", if accepted by user
                message = S.util.removeHtmlTags(message);

                let n = new Notification(title, {
                    body: message,

                    /* Chrome is showing it's own icon/image instead of the custom one and I'm not sure why. I've tried
                     both image and icon here and neither works. */
                    image: window.location.origin + "/branding/logo-50px-tr.jpg"
                });
            });
        }
    }

    refresh = (state: AppState): void => {
        // S.view.jumpToId(state.node.id);
        S.view.refreshTree(null, false, true, null, false, true, true, state);
    }

    selectTab = (tabName: string): void => {
        /* if tab is already active no need to update state now

        SOME codepaths like (openNode) are currently relying on selectTab
        to cause the dispatch/update, even when tab isn't changing, so need
        to find all those before we can optimize here to ignore setting to same tab.
        */
        // if (state.activeTab==tabName) return;

        dispatch("Action_SelectTab", (s: AppState): AppState => {
            if (tabName === C.TAB_MAIN && !s.node) {
                S.nav.navHome(s);
            }
            else {
                s.guiReady = true;
                this.tabChanging(s.activeTab, tabName, s);
                s.activeTab = S.quanta.activeTab = tabName;
            }
            return s;
        });
    }

    /* Does a select tab that's safe within a dispatch (i.e. doesn't itself dispatch) */
    selectTabStateOnly = (tabName: string, state: AppState): void => {
        if (tabName === C.TAB_MAIN && !state.node) {

            // we need to run immediately but in a timer so it doesn't happen in this call stack and trigger
            // an error that we did a dispatch in a dispatch.
            setTimeout(() => {
                S.nav.navHome(null);
            }, 1);
        }
        else {
            this.tabChanging(state.activeTab, tabName, state);
            state.activeTab = S.quanta.activeTab = tabName;
        }
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
            Log.log("no selected nodes.");
        }

        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            const node: J.NodeInfo = state.idToNodeMap.get(id);
            if (!node) {
                Log.log("unable to find idToNodeMap for id=" + id);
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
            const node = state.idToNodeMap.get(id);
            if (node) {
                selArray.push(node);
            }
            return true;
        });
        return selArray;
    }

    clearSelNodes = (state: AppState = null) => {
        state = appState(state);
        dispatch("Action_ClearSelections", (s: AppState): AppState => {
            s.selectedNodes = {};
            return s;
        });
    }

    selectAllNodes = (nodeIds: string[]) => {
        // DO NOT DELETE (feature work in progress)
        // //todo-2: large numbers of selected nodes isn't going to scale well in this design
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
        const id: string = S.quanta.parentIdToFocusNodeMap.get(state.node.id);
        if (id) {
            return state.idToNodeMap.get(id);
        }
        return null;
    }

    /* Returns true if successful */
    highlightRowById = (id: string, scroll: boolean, state: AppState): boolean => {
        // Log.log("highlightRowById: " + id);
        let node: J.NodeInfo = state.idToNodeMap.get(id);
        let ret = true;

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
            ret = false;
            // Log.log("highlightRowById failed to find id: " + id);
        }
        return ret;
    }

    highlightNode = (node: J.NodeInfo, scroll: boolean, state: AppState): void => {
        if (!node || !state.node) {
            return;
        }

        if (!state.isAnonUser) {
            S.util.updateHistory(state.node, node, state);
        }
        S.quanta.parentIdToFocusNodeMap.set(state.node.id, node.id);

        if (scroll) {
            S.view.scrollToSelectedNode(state);
        }
    }

    /* Find node by looking everywhere we possibly can on local storage for it */
    findNodeById = (state: AppState, nodeId: string): J.NodeInfo => {
        // first look in normal tree map for main view.
        let node: J.NodeInfo = state.idToNodeMap.get(nodeId);

        if (!node) {
            node = state.feedResults.find(n => n.id === nodeId);
        }

        if (!node) {
            for (let data of state.tabData) {
                if (data.rsInfo && data.rsInfo.results) {
                    node = data.rsInfo.results.find(n => n.id === nodeId);
                    if (node) break;
                }
            }
        }
        return node;
    }

    clearLastNodeIds = (): void => {
        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, null);
        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, null);
    }

    /* WARNING: This is NOT the highlighted node. This is whatever node has the CHECKBOX selection */
    getSingleSelectedNode = (state: AppState): J.NodeInfo => {
        let ret = null;
        S.util.forEachProp(state.selectedNodes, (id, val): boolean => {
            ret = state.idToNodeMap.get(id);
            return false;
        });
        return ret;
    }

    /* Returns true if this node is able to have an effect on the tree, such that if it changed
    we would need to re-render the tree. For root top level call node==state.node */
    nodeIdIsVisible = (node: J.NodeInfo, nodeId: string, parentPath: string, state: AppState): boolean => {
        if (!nodeId || !node) return false;
        if (node.id === nodeId || node.path === parentPath) return true;

        let ret = false;
        if (node.children) {
            // for now we do ONE level, and this would fail for
            node.children.forEach((n: any) => {
                if (this.nodeIdIsVisible(n, nodeId, parentPath, state)) {
                    ret = true;
                }
            }, this);
        }
        return ret;
    }

    updateNodeMap = (node: J.NodeInfo, state: AppState): void => {
        if (!node) return;
        state.idToNodeMap.set(node.id, node);

        // NOTE: only the getFeed call (Feed tab) will have items with some parents populated.
        if (node.parent) {
            state.idToNodeMap.set(node.parent.id, node.parent);
        }

        if (node.children) {
            node.children.forEach(function (n) {
                this.updateNodeMap(n, state);
            }, this);
        }
    }

    /* Returns the node if it's currently displaying on the page. For now we don't have ability */
    getDisplayingNode = (state: AppState, nodeId: string): J.NodeInfo => {
        if (!state.node) return null;
        if (state.node.id === nodeId) return state.node;
        if (!state.node.children) return null;
        return state.node.children.find(node => node.id === nodeId);
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
            Log.log("initApp()");

            if (history.scrollRestoration) {
                history.scrollRestoration = "manual";
            }

            S.render.initMarkdown();

            this.createAppTabs();
            const state: AppState = store.getState();
            state.pendingLocationHash = window.location.hash;
            S.plugin.initPlugins();

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
                Log.log("POPSTATE: location: " + document.location + ", state: " + JSON.stringify(event.state));

                if (event.state && event.state.nodeId) {
                    S.view.refreshTree(event.state.nodeId, true, true, event.state.highlightId, false, true, true, store.getState());
                    this.selectTab(C.TAB_MAIN);
                }
            };

            document.body.addEventListener("click", function (e: any) {
                e = e || window.event;
                let target: HTMLElement = e.target;

                // Whenever something is clicked, forget the pending focus data
                Comp.focusElmId = null;
                // Log.log("document.body.click target.id=" + target.id);
            }, false);

            // DO NOT DELETE. Useful for debugging.
            document.body.addEventListener("focusin", function (e: any) {
                // Log.log("focusin id=" + e.target.id);
            });

            // This is a cool way of letting CTRL+UP, CTRL+DOWN scroll to next node.
            // WARNING: even with tabIndex added none of the other DIVS react renders seem to be able to accept an onKeyDown event.
            // Todo: before enabling this need to make sure 1) the Main Tab is selected and 2) No Dialogs are Open, because this WILL
            // capture events going to dialogs / edit fields
            document.body.addEventListener("keydown", (event: KeyboardEvent) => {
                // Log.log("keydown: " + event.code);
                let state: AppState = store.getState();

                switch (event.code) {
                    case "ControlLeft":
                        this.ctrlKey = true;
                        this.ctrlKeyTime = new Date().getTime();
                        break;
                    case "Escape":
                        if (S.quanta.fullscreenViewerActive(state)) {
                            S.nav.closeFullScreenViewer(state);
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

            document.body.addEventListener("keyup", (event: KeyboardEvent) => {
                switch (event.code) {
                    case "ControlLeft":
                        this.ctrlKey = false;
                        this.ctrlKeyTime = -1;
                        break;
                    default: break;
                }
            });

            if (this.appInitialized) {
                return;
            }

            this.appInitialized = true;

            S.props.initConstants();
            this.displaySignupMessage();

            window.addEventListener("orientationchange", () => {
                // we force the page to re-render with an all new state.
                dispatch("Action_orientationChange", (s: AppState): AppState => {
                    return s;
                });
            });

            // not used. do not delete.
            // window.addEventListener("resize", () => {
            //     deviceWidth = window.innerWidth;
            //     deviceHeight = window.innerHeight;
            // });

            // This works, but is not needed. do not delete.
            // window.addEventListener("hashchange", function () {
            //     Log.log("The hash has changed: hash=" + location.hash);
            // }, false);

            this.initClickEffect();

            // todo-2: actually this is a nuisance unless user is actually EDITING a node right now
            // so until i make it able to detect if user is editing i'm removing this.
            // do not delete.
            // window.onbeforeunload = () => {
            //     return "Leave [appName] ?";
            // };

            Log.log("creating App");
            // This is the root react App component that contains the entire application
            this.app = new App(); // new AppDemo

            if ((window as any).__page === "index") {
                this.app.updateDOM(store, "app");
            }
            else if ((window as any).__page === "welcome") {
                let welcomePanel = new WelcomePanel();
                welcomePanel.updateDOM(store, "welcomePanel");
            }

            /*
             * This call checks the server to see if we have a session already, and gets back the login information from
             * the session, and then renders page content, after that.
             */
            S.user.refreshLogin(store.getState());

            S.util.initProgressMonitor();
            this.processUrlParams(null);
            this.setOverlay(false);

            // Initialize the 'ServerPush' client-side connection
            S.push.init();

            this.playAudioIfRequested();

            await S.util.ajax<J.GetConfigRequest, J.GetConfigResponse>("getConfig", {
            },
                (res: J.GetConfigResponse): void => {
                    if (res.config) {
                        S.quanta.config = res.config;
                    }
                });

            Log.log("initApp complete.");
            this.enableMouseEffect();

            setTimeout(() => {
                S.encryption.initKeys();
            }, 1000);

            resolve();
        });
    }

    loadBookmarks = (): void => {
        let state: AppState = store.getState();
        if (!state.isAnonUser) {
            S.util.ajax<J.GetBookmarksRequest, J.GetBookmarksResponse>("getBookmarks", {
            },
                (res: J.GetBookmarksResponse): void => {
                    // let count = res.bookmarks ? res.bookmarks.length : 0;
                    // Log.log("bookmark count=" + count);
                    dispatch("Action_loadBookmarks", (s: AppState): AppState => {
                        s.bookmarks = res.bookmarks;
                        return s;
                    });
                });
        }
    }

    createAppTabs = (): void => {
        dispatch("Action_initTabs", (s: AppState): AppState => {
            s.tabData = [
                {
                    name: "Main",
                    id: C.TAB_MAIN,
                    isVisible: () => true,
                    constructView: (data: TabDataIntf) => new MainTabComp(s, data),
                    rsInfo: null,
                    scrollPos: 0
                },
                {
                    name: "Search",
                    id: C.TAB_SEARCH,
                    isVisible: () => this.resultSetHasData(C.TAB_SEARCH),
                    constructView: (data: TabDataIntf) => new SearchResultSetView(s, data),
                    rsInfo: new ResultSetInfo(),
                    scrollPos: 0
                },
                {
                    name: "Shared Nodes",
                    id: C.TAB_SHARES,
                    isVisible: () => this.resultSetHasData(C.TAB_SHARES),
                    constructView: (data: TabDataIntf) => new SharedNodesResultSetView<SharesRSInfo>(s, data),
                    rsInfo: new SharesRSInfo(),
                    scrollPos: 0
                },
                {
                    name: "Timeline",
                    id: C.TAB_TIMELINE,
                    isVisible: () => this.resultSetHasData(C.TAB_TIMELINE),
                    constructView: (data: TabDataIntf) => new TimelineResultSetView<TimelineRSInfo>(s, data),
                    rsInfo: new TimelineRSInfo(),
                    scrollPos: 0
                },
                {
                    name: "Followers",
                    id: C.TAB_FOLLOWERS,
                    isVisible: () => this.resultSetHasData(C.TAB_FOLLOWERS),
                    constructView: (data: TabDataIntf) => new FollowersResultSetView<FollowersRSInfo>(s, data),
                    rsInfo: new FollowersRSInfo(),
                    scrollPos: 0
                },
                {
                    name: "Following",
                    id: C.TAB_FOLLOWING,
                    isVisible: () => this.resultSetHasData(C.TAB_FOLLOWING),
                    constructView: (data: TabDataIntf) => new FollowingResultSetView<FollowingRSInfo>(s, data),
                    rsInfo: new FollowingRSInfo(),
                    scrollPos: 0
                },
                {
                    name: "Feed",
                    id: C.TAB_FEED,
                    isVisible: () => true,
                    constructView: (data: TabDataIntf) => new FeedView(s, data),
                    rsInfo: null,
                    scrollPos: 0
                },
                {
                    name: "Trending",
                    id: C.TAB_TRENDING,
                    isVisible: () => true,
                    constructView: (data: TabDataIntf) => new TrendingView(s, data),
                    rsInfo: new TrendingRSInfo(),
                    scrollPos: 0
                },
                {
                    name: "Server Info",
                    id: C.TAB_SERVERINFO,
                    isVisible: () => {
                        let state: AppState = store.getState();
                        return !!state.serverInfoText;
                    },
                    constructView: (data: TabDataIntf) => new ServerInfoView(s, data),
                    rsInfo: null,
                    scrollPos: 0
                }

                // this is throwing a react error, but we don't need this now anyaay
                // {
                //     name: "Log",
                //     id: C.TAB_LOG,
                //     isVisible: () => {
                //         // this function needs to get the state itself.
                //         let state = store.getState();
                //         return state.isAdminUser;
                //     },
                //     constructView: (data: TabDataIntf) => new LogView(data),
                //     rsInfo: null
                // }
            ];
            return s;
        });
    }

    resultSetHasData = (id: string) => {
        let state: AppState = store.getState();
        let data = state.tabData.find(d => d.id === id);
        return data && data.rsInfo && data.rsInfo.results && data.rsInfo.results.length > 0;
    }

    getActiveTabComp = (state: AppState): CompIntf => {
        if (!state.tabData) return null;
        let data = state.tabData.find(d => d.id === state.activeTab);
        return data ? data.inst : null;
    }

    tabScrollTop = (state: AppState, tabName: string) => {
        let data = state.tabData.find(d => d.id === tabName);
        if (data) {
            data.scrollPos = 0;
        }
    }

    /* This function manages persisting the scroll position when switching
    from one tab to another, to automatically restore the scroll position that was
    last scroll position on any given tab */
    tabChanging = (prevTab: string, newTab: string, state: AppState): void => {

        /* Don't run any code here if we aren't actually changing tabs */
        if (prevTab && newTab && prevTab === newTab) {
            return;
        }

        // Log.log("Changing from tab: " + prevTab + " to " + newTab);
        PubSub.pub(C.PUBSUB_tabChanging, newTab);
    }

    /* We look at the node, and get the parent path from it, and then if there is a node matching that being displayed
    in the tree we ensure that the "Open" button is visible. This normally indicates this node has been replied to

    If a reducer is running, just pass the state, because it will be the state we need, but if not we will be doing a
    getState and then dispatching the change.
    */
    showOpenButtonOnNode = (node: J.NodeInfo, state: AppState): void => {
        if (!node || !state.node || !state.node.children) return;
        let doDispatch = state == null;
        if (!state) {
            state = store.getState();
        }
        let path = node.path;
        let slashIdx: number = path.lastIndexOf("/");
        if (slashIdx === -1) return;
        let parentPath = path.substring(0, slashIdx);

        /* scan all children being displayed and of one of them is the target parent set the hasChildren
        on it so it'll display the "open" button */
        for (let node of state.node.children) {
            if (node.path === parentPath) {
                node.hasChildren = true;
                if (doDispatch) {
                    dispatch("Action_NodeChanges", (s: AppState): AppState => {
                        return state;
                    });
                }
                // break out of loop, we're done here.
                break;
            }
        }
    }

    enableMouseEffect = async () => {
        let mouseEffect = await S.localDB.getVal(C.LOCALDB_MOUSE_EFFECT, "allUsers");
        dispatch("Action_ToggleMouseEffect", (s: AppState): AppState => {
            s.mouseEffect = mouseEffect === "1";
            return s;
        });
    }

    /* #mouseEffects (do not delete tag) */
    toggleMouseEffect = () => {
        dispatch("Action_ToggleMouseEffect", (s: AppState): AppState => {
            s.mouseEffect = !s.mouseEffect;
            S.localDB.setVal(C.LOCALDB_MOUSE_EFFECT, s.mouseEffect ? "1" : "0", "allUsers");
            return s;
        });
    }

    /*
    The other part of this is contained in click-effects.scss
    */
    initClickEffect = () => {
        let clickEffect = (e) => {
            let state = store.getState();
            /* looks like for some events there's not a good mouse position (happened on clicks to drop down cobo boxes),
             and is apparently 0, 0, so we just check the sanity of the coordinates here */
            if (!state.mouseEffect || (e.clientX < 10 && e.clientY < 10)) return;
            this.runClickAnimation(e.clientX, e.clientY);
        };
        document.addEventListener("click", clickEffect);
    }

    runClickAnimation = (x: number, y: number) => {
        let d = document.createElement("div");
        d.className = "clickEffect";

        /* todo-2: make this 5 and 12 offset user configurable. I'm using a custom moust pointer that draws a yellow
        circle around my mouse for use with this effect, to record screencast videos, and that icon circle is not centered
        around the actual mouse click arrow tip location, so we have to use an offset here (only when that Linux OS mouse theme is used)
        to get our expanding circle in CSS to be perfectly centered with the one in the mouse theme, becasue an off center look
        is terrible but the 5 and 12 makes it perfect */
        d.style.left = `${x + 5}px`;
        d.style.top = `${y + 12}px`;
        document.body.appendChild(d);

        // This proved not to be reliable and was able to leave
        // dangling orphans not in use, but the timer approach below
        // should be bulletproof.
        // let func = () => {
        //     d.parentElement.removeChild(d);
        // };
        // d.addEventListener("animationend", func);

        setTimeout(() => {
            d.parentElement.removeChild(d);
        }, 400); // this val is in 3 places. put the TS two in a constantas file.
    }

    playAudioIfRequested = () => {
        let audioUrl = S.util.getParameterByName("audioUrl");
        if (audioUrl) {
            let startTimeStr = S.util.getParameterByName("t");
            let startTime = startTimeStr ? parseInt(startTimeStr) : 0;
            setTimeout(() => {
                new AudioPlayerDlg(null, null, null, audioUrl, startTime, store.getState()).open();
            }, 500);
        }
    }

    keyDebounce = () => {
        const now = S.util.currentTimeMillis();
        // allow one operation every quarter second.
        if (Quanta.lastKeyDownTime > 0 && now - Quanta.lastKeyDownTime < 250) {
            return true;
        }
        Quanta.lastKeyDownTime = now;
        return false;
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

        Quanta.overlayCounter += showOverlay ? 1 : -1;
        // Log.log("overlayCounter=" + Meta64.overlayCounter);

        /* if overlayCounter goes negative, that's a mismatch */
        if (Quanta.overlayCounter < 0) {
            throw new Error("Overlay calls are mismatched");
        }

        if (Quanta.overlayCounter === 1) {

            /* Whenever we are about to show the overlay always give the app 0.7 seconds before showing the overlay in case
            the app did something real fast and the display of the overlay would have just been a wasted annoyance (visually)
            and just simply caused a bit of unnecessary eye strain
            */
            setTimeout(() => {
                // after the timer we check for the counter still being greater than zero (not an ==1 this time).
                if (Quanta.overlayCounter > 0) {
                    // Log.log("showing overlay.");
                    const elm = S.util.domElm("overlayDiv");
                    if (elm) {
                        elm.style.display = "block";
                        elm.style.cursor = "wait";
                    }
                }
            }, 1200);
        }
        else if (Quanta.overlayCounter === 0) {
            // Log.log("hiding overlay.");
            const elm = S.util.domElm("overlayDiv");
            if (elm) {
                elm.style.display = "none";
            }
        }
        // Log.log("overlayCounter=" + Meta64.overlayCounter);
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

    loadAnonPageHome = (state: AppState): void => {
        Log.log("loadAnonPageHome()");

        S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad", null,
            (res: J.RenderNodeResponse): void => {
                if (!res.success || res.errorType === J.ErrorType.AUTH) {
                    S.util.showMessage("Unable to access the requested page without being logged in. Try loading the URL without parameters, or log in.", "Warning");
                }
                state = appState(state);
                S.render.renderPageFromData(res, false, null, true, true);
            },
            (res: any): void => {
                Log.log("loadAnonPage Home ajax fail");
                S.nav.login(state);
            }
        );
    }

    setUserPreferences = (state: AppState, flag: boolean) => {
        if (flag !== state.userPreferences.editMode) {
            state.userPreferences.editMode = flag;
            S.quanta.saveUserPreferences(state);
        }
    }

    saveUserPreferences = (state: AppState): void => {
        if (!state.isAnonUser) {
            S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userPreferences: state.userPreferences
            });
        }

        dispatch("Action_SetUserPreferences", (s: AppState): AppState => {
            s.userPreferences = state.userPreferences;
            return s;
        });
    }

    openSystemFile = (fileName: string) => {
        S.util.ajax<J.OpenSystemFileRequest, J.OpenSystemFileResponse>("openSystemFile", {
            fileName
        });
    }

    setStateVarsUsingLoginResponse = (res: J.LoginResponse): void => {
        if (!res) return;

        dispatch("Action_LoginResponse", (s: AppState): AppState => {
            if (res.rootNode) {
                s.homeNodeId = res.rootNode;
                s.homeNodePath = res.rootNodePath;
            }
            s.userName = res.userName;
            s.isAdminUser = res.userName === "admin";
            s.isAnonUser = res.userName === J.PrincipalName.ANON;

            Log.log("LoginResponse userName = " + res.userName);

            // bash scripting is an experimental feature, and i'll only enable for admin for now, until i'm
            // sure i'm keeping this feature.
            s.allowBashScripting = false;

            s.anonUserLandingPageNode = res.anonUserLandingPageNode;
            s.allowFileSystemSearch = res.allowFileSystemSearch;
            s.userPreferences = res.userPreferences;
            s.title = !s.isAnonUser ? res.userName : "";
            s.displayName = !s.isAnonUser ? res.displayName : "";
            return s;
        });
    }

    // todo-2: need to decide if I want this. It's disabled currently (not called)
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

    ctrlKeyCheck = (): boolean => {
        return this.ctrlKey && (new Date().getTime() - this.ctrlKeyTime) < 2500;
    }

    // todo-1: both these two methods below should be moved to 'nav.ts'
    showMyNewMessages = (): void => {
        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: true,
            feedFilterFromMe: true,
            feedFilterToPublic: false,
            feedFilterLocalServer: false
        });
    }

    showPublicFediverse = (): void => {
        S.nav.messages({
            feedFilterFriends: false,
            feedFilterToMe: false,
            feedFilterFromMe: false,
            feedFilterToPublic: true,
            feedFilterLocalServer: false
        });
    }
}
