import { appState, dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { App } from "./comp/App";
import { Comp } from "./comp/base/Comp";
import { CompIntf } from "./comp/base/CompIntf";
import { OpenGraphPanel } from "./comp/OpenGraphPanel";
import { WelcomePanel } from "./comp/WelcomePanel";
import { Constants as C } from "./Constants";
import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import { ChangePasswordDlg } from "./dlg/ChangePasswordDlg";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import * as J from "./JavaIntf";
import { Log } from "./Log";
import { NodeHistoryItem } from "./NodeHistoryItem";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Quanta {
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

    public currentFocusId: string = null;

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
    nodeHistoryLocked: boolean;

    sendTestEmail = async () => {
        await S.util.ajax<J.SendTestEmailRequest, J.SendTestEmailResponse>("sendTestEmail");
        S.util.showMessage("Send Test Email Initiated.", "Note");
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
        if (C.DEBUG_SCROLLING) {
            console.log("Quanta.refresh");
        }
        // S.view.jumpToId(state.node.id);
        S.view.refreshTree(null, false, true, null, false, true, true, true, false, state);
    }

    initApp = async (): Promise<void> => {
        Log.log("initApp()");

        if (history.scrollRestoration) {
            history.scrollRestoration = "manual";
        }

        S.render.initMarkdown();

        S.tabUtil.createAppTabs();
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
                S.view.refreshTree(event.state.nodeId, true, true, event.state.highlightId, false, false, true, true, false, store.getState());
                S.tabUtil.selectTab(C.TAB_MAIN);
            }
        };

        /* We have to run this timer to wait for document.body to exist becasue we load our JS in the HTML HEAD
        and we load in the head because we need our styling in place BEFORE the page renders or else you get that
        well-known issue of a momentarily unstyled render before the page finishes loading */
        const interval = setInterval(() => {
            if (!document?.body) {
                console.log("Waiting for document.body");
                return;
            }
            clearInterval(interval);

            document.body.addEventListener("click", function (e: any) {
                e = e || window.event;
                let target: HTMLElement = e.target;

                // Whenever something is clicked, forget the pending focus data
                Comp.focusElmId = null;
                // Log.log("document.body.click target.id=" + target.id);
            }, false);

            document.body.addEventListener("focusin", (e: any) => {
                // Log.log("focusin id=" + e.target.id);
                this.currentFocusId = e.target.id;
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
        }, 250);

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
        this.playAudioIfRequested();

        let res: J.GetConfigResponse = await S.util.ajax<J.GetConfigRequest, J.GetConfigResponse>("getConfig");
        if (res.config) {
            S.quanta.config = res.config;
        }

        Log.log("initApp complete.");
        this.enableMouseEffect();

        setTimeout(() => {
            S.encryption.initKeys();
        }, 1000);
    }

    loadBookmarks = async (): Promise<void> => {
        let state: AppState = store.getState();
        if (!state.isAnonUser) {
            let res: J.GetBookmarksResponse = await S.util.ajax<J.GetBookmarksRequest, J.GetBookmarksResponse>("getBookmarks");
            // let count = res.bookmarks ? res.bookmarks.length : 0;
            // Log.log("bookmark count=" + count);
            dispatch("Action_loadBookmarks", (s: AppState): AppState => {
                s.bookmarks = res.bookmarks;
                return s;
            });
        }
    }

    /* We look at the node, and get the parent path from it, and then if there is a node matching that's being displayed
    in the tree we ensure that the "Open" button is visible. This normally indicates this node has been replied to

    If a reducer is running, just pass the state, because it will be the state we need, but if not we will be doing a
    getState and then dispatching the change.
    */
    refreshOpenButtonOnNode = (node: J.NodeInfo, state: AppState): void => {
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

    loadAnonPageHome = async (state: AppState): Promise<void> => {
        Log.log("loadAnonPageHome()");

        try {
            let res: J.RenderNodeResponse = await S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("anonPageLoad");

            // if we have trouble accessing even the anon page just drop out to landing page.
            if (!res.success || res.errorType === J.ErrorType.AUTH) {
                window.location.href = window.location.origin;
                return;
            }
            state = appState(state);
            S.render.renderPageFromData(res, false, null, true, true);
        }
        catch (e) {
            Log.log("loadAnonPage Home ajax fail");
            S.nav.login(state);
        }
    }

    setUserPreferences = (state: AppState, flag: boolean) => {
        if (flag !== state.userPreferences.editMode) {
            state.userPreferences.editMode = flag;
            S.quanta.saveUserPreferences(state);
        }
    }

    saveUserPreferences = async (state: AppState): Promise<void> => {
        if (!state.isAnonUser) {
            await S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userPreferences: state.userPreferences
            });
        }

        dispatch("Action_SetUserPreferences", (s: AppState): AppState => {
            s.userPreferences = state.userPreferences;
            return s;
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
    removeRedundantFeedItems = (feedRes: J.NodeInfo[]): J.NodeInfo[] => {
        if (!feedRes || feedRes.length === 0) return feedRes;

        // first build teh set of ids that that are in 'ni.parent.id'
        const idSet: Set<string> = new Set<string>();
        feedRes.forEach((ni: J.NodeInfo) => {
            if (ni.parent) {
                idSet.add(ni.parent.id);
            }
        });

        // now return filtered list only for items where 'id' is not in the set above.
        return feedRes.filter(ni => !idSet.has(ni.id));
    }

    fullscreenViewerActive = (state: AppState): boolean => {
        return !!(state.fullScreenViewId || state.fullScreenGraphId || state.fullScreenCalendarId);
    }

    ctrlKeyCheck = (): boolean => {
        return this.ctrlKey && (new Date().getTime() - this.ctrlKeyTime) < 2500;
    }
}
