import { dispatch, getAs } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Constants as C } from "./Constants";
import { MainMenuDlg } from "./dlg/MainMenuDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { HistoryUtil } from "./HistoryUtil";
import { FullScreenType } from "./Interfaces";
import * as J from "./JavaIntf";
import { PrincipalName } from "./JavaIntf";
import { Log } from "./Log";
import { S } from "./Singletons";
import { AISettingsTab } from "./tabs/data/AISettingsTab";
import { DocumentTab } from "./tabs/data/DocumentTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { StatisticsTab } from "./tabs/data/StatisticsTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { StatisticsView } from "./tabs/StatisticsView";

export class Quanta {
    // initialized in main.ts
    config: J.ClientConfig = null;

    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    // this is a convenience var pointing to Quanta.config.config
    cfg: { [index: string]: any };

    mainMenu: MainMenuDlg;
    noScrollToId: string = null;
    pendingLocationHash: string;

    newNodeTargetId: string;
    newNodeTargetOffset: number;
    audioPlaying = false;

    app: Comp;
    appInitialized: boolean = false;
    curUrlPath: string = window.location.pathname + window.location.search;

    // This holds the currently highlighted node (the val) for the given page parent node (the key)
    parentIdToFocusNodeMap: Map<string, string> = new Map<string, string>();

    curHighlightNodeCompRow: Comp = null;

    private static lastKeyDownTime: number = 0;

    /* We want to only be able to drag nodes by clicking on their TYPE ICON, and we accomplish that
    by using the mouseover/mouseout on those icons to detect an 'is mouse over' condition any time a
    drag attempt is started on a row and only allow it if mouse is over the icon */
    public draggingId: string = null;

    // use this to know how long to delay the refresh for breadrumbs should wait to keep from
    // interrupting the fade effect by doing which would happen if it rendered before the fade
    // effect was complete. (see fadeInRowBkgClz)
    public fadeStartTime: number = 0;

    public currentFocusId: string = null;

    /* We save userName+password in these vars to pass in every request so that we can log back in
    again silently after any session timeout */
    userName: string = PrincipalName.ANON;
    authToken: string;
    loggingOut: boolean;

    // WARNING: Call S.util.ctrlKeyCheck() to check for ctrlKey and NOT just the state of this. (I
    // should've just used a timer to set back to false, but instead for now it's checked by calling
    // ctrlKeyCheck)
    ctrlKey: boolean;
    ctrlKeyTime: number;

    // maps the hash of an encrypted block of text to the unencrypted text, so that we never run the same
    // decryption code twice.
    decryptCache: Map<string, string> = new Map<string, string>();

    /* Map of all URLs and the openGraph object retrieved for it */
    openGraphData: Map<string, J.OpenGraph> = new Map<string, J.OpenGraph>();
    imageUrls: Set<string> = new Set<string>();

    dragImg: any = null;
    dragElm: any = null;

    selectedForTts: string = null;

    refresh() {
        if (C.DEBUG_SCROLLING) {
            console.log("Quanta.refresh");
        }
        // S.view.jumpToId(state.node.id);
        S.view.refreshTree({
            nodeId: null,
            zeroOffset: false,
            highlightId: null,
            scrollToTop: true,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            jumpToRss: false
        });
    }

    invalidateKeys() {
        S.crypto.invalidateKeys();
    }

    async initKeys(user: string) {
        if (S.crypto.avail) {
            await S.crypto.initKeys(user, false, false, false, "all");
        }
    }

    _onPopState = async (event) => {
        // Log.log("POPSTATE: location: " + document.location + ", state: " + JSON.stringify(event.state));
        HistoryUtil.historyUpdateEnabled = false;

        try {
            // parse the value of the 'view' parameter in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get("view");

            // first check if we need to navigate to a view (instead of the default being the Folders view)
            switch (view) {
                case DocumentTab.URL_PARAM:
                    if (DocumentTab.selectIfOpened()) return;
                    break;
                case FeedTab.URL_PARAM:
                    if (FeedTab.selectIfOpened()) return;
                    break;
                case StatisticsTab.URL_PARAM:
                    if (StatisticsTab.selectIfOpened()) return;
                    break;
                case TimelineTab.URL_PARAM:
                    if (TimelineTab.selectIfOpened()) return;
                    break;
                case ThreadTab.URL_PARAM:
                    if (ThreadTab.selectIfOpened()) return;
                    break;
                case AISettingsTab.URL_PARAM:
                    if (AISettingsTab.selectIfOpened()) return;
                    break;
                default: break;
            }

            if (event.state?.nodeId) {
                await S.view.refreshTree({
                    nodeId: event.state.nodeId,
                    zeroOffset: true,
                    highlightId: event.state.highlightId,
                    scrollToTop: false,
                    allowScroll: true,
                    setTab: true,
                    forceRenderParent: false,
                    jumpToRss: false
                });
                S.tabUtil.selectTab(C.TAB_MAIN);
            }
        }
        finally {
            HistoryUtil.historyUpdateEnabled = true;
        }
    }

    async initApp() {
        if (this.appInitialized) {
            throw new Error("initApp called multiple times.");
        }
        this.appInitialized = true;
        S.histUtil.initHistorySaver();

        try {
            this.setOverlay(false);
            this.dragImg = new Image();
            // this.dragImg.src = "/images/favicon-32x32.png";

            if (S.quanta.config.requireCrypto && !S.crypto.avail) {
                console.error("Crypto not available in browser.");
                return;
            }

            const mobileMode: string = await S.localDB.getVal(C.LOCALDB_MOBILE_MODE);
            dispatch("InitState", async (s: AppState) => {
                if (mobileMode) {
                    s.mobileMode = mobileMode === "true";
                }
            });

            if (history.scrollRestoration) {
                history.scrollRestoration = "manual";
            }

            console.log("createTabs");
            await S.tabUtil.createAppTabs();

            this.pendingLocationHash = window.location.hash;

            console.log("createPlugins");
            S.plugin.initPlugins();

            (window as any).addEvent = (object: any, type: any, callback: any) => {
                if (!object || typeof (object) === "undefined") {
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
            NOTE: This works in conjunction with pushState, and is part of what it takes to make the
            back button (browser hisotry) work in SPAs
            */
            window.onpopstate = this._onPopState;

            this.addPageLevelEventListeners();
            Log.log("initConstants");
            S.props.initConstants();

            window.addEventListener("orientationchange", () => {
                // we force the page to re-render with an all new state.
                dispatch("orientationChange", () => { });
            });

            // not used. do not delete.
            window.addEventListener("resize", () => {
                // for mobile mode we leave showRhs true always
                if (getAs().mobileMode) return;

                if ((window.innerWidth < 1024 && this.screenWidth >= 1024) ||
                    (window.innerWidth >= 1024 && this.screenWidth < 1024)) {
                    dispatch("browserResize", s => s.showRhs = window.innerWidth >= 1024);
                }
                this.screenWidth = window.innerWidth;
            });

            // This works, but is not needed. do not delete.
            // window.addEventListener("hashchange", function () {
            //     Log.log("The hash has changed: hash=" + location.hash);
            // }, false);
            // do not delete.
            // window.onbeforeunload = () => {
            //     return "Leave [appName] ?";
            // };

            await S.user.initLoginState();
            console.log("refreshLogin completed.");

            S.rpcUtil.initRpcTimer();
            S.util.checkChangePassword();

            if (this.config.config) {
                dispatch("configUpdates", _s => {

                    // we show the user message after the config is set, but there's no reason to do it here
                    // other than perhaps have the screen updated with the latest based on the config.
                    setTimeout(() => {
                        if (S.quanta.config.userMsg) {
                            S.util.showMessage(S.quanta.config.userMsg, "");
                            S.quanta.config.userMsg = null;
                        }

                        if (S.quanta.config.displayUserProfileId) {
                            new UserProfileDlg(S.quanta.config.displayUserProfileId).open();
                            S.quanta.config.displayUserProfileId = null;
                        }

                        S.tourUtils.init();
                    }, 100);
                });
            }

            await this.initialRender();
            console.log("initApp complete.");
            if (S.quanta.config.login) {
                S.user.userLogin();
            }
        }
        catch (e: any) {
            S.util.logErr(e);
            alert("App failed to start: " + e?.message || "");
            throw e;
        }
        finally {
            dispatch("AppInitComplete", s => s.appInitComplete = true);
        }
    }

    resetPageLoadConfigs() {
        this.config.urlView = null;
        this.config.initialNodeId = null;
    }

    async initialRender() {
        let initialTab = null;
        switch (this.config.urlView) {
            case DocumentTab.URL_PARAM:
                initialTab = C.TAB_DOCUMENT;
                break;
            case FeedTab.URL_PARAM:
                initialTab = C.TAB_FEED;
                break;
            case StatisticsTab.URL_PARAM:
                initialTab = C.TAB_STATS;
                break;
            case ThreadTab.URL_PARAM:
                initialTab = C.TAB_THREAD;
                break;
            case TimelineTab.URL_PARAM:
                initialTab = C.TAB_TIMELINE;
                break;
            default:
                initialTab = C.TAB_MAIN;
                break;
        }

        if (initialTab === C.TAB_STATS) {
            S.tabUtil.selectTab(initialTab);
            return;
        }

        if (initialTab === C.TAB_FEED) {
            if (S.quanta.config.search) {
                StatisticsView._searchWord(null, S.quanta.config.search);
            }
            else {
                S.tabUtil.selectTab(initialTab);
            }
            return;
        }

        if (initialTab === C.TAB_THREAD && S.quanta.config.initialNodeId) {
            S.srch.showThread(S.quanta.config.initialNodeId);
            return;
        }

        if (initialTab === C.TAB_DOCUMENT && S.quanta.config.initialNodeId) {
            S.nav.openDocumentView(null, S.quanta.config.initialNodeId);
            S.quanta.config.initialNodeId = null;
            return;
        }

        if (initialTab === C.TAB_TIMELINE && S.quanta.config.initialNodeId) {
            S.nav.runTimelineByNodeId(S.quanta.config.initialNodeId);
            S.quanta.config.initialNodeId = null;
            return;
        }

        /* set ID to be the page we want to show user right after login */
        let id: string = null;
        const ast = getAs();

        if (S.quanta.config.initialNodeId) {
            id = S.quanta.config.initialNodeId;
            S.quanta.config.initialNodeId = null;
        } //
        else {
            id = ast.userProfile?.userNodeId;
        }

        await S.view.refreshTree({
            nodeId: id,
            zeroOffset: true,
            highlightId: null,
            scrollToTop: false,
            allowScroll: true,
            setTab: true,
            forceRenderParent: false,
            jumpToRss: true
        });
    }

    // landscape v.s. portrait
    isLandscapeOrientation() {
        return window.innerWidth > window.innerHeight;
    }

    addPageLevelEventListeners() {
        /* We have to run this timer to wait for document.body to exist because we load our JS in
            the HTML HEAD because we need our styling in place BEFORE the page renders or else you
            get that well-known issue of a momentarily unstyled render before the page finishes
            loading */
        const interval = setInterval(() => {
            if (!document?.body) {
                console.log("Waiting for document.body");
                return;
            }
            clearInterval(interval);

            document.body.addEventListener("click", function (e: any) {
                e = e || window.event;
                // const target: HTMLElement = e.target;

                // Whenever something is clicked, forget the pending focus data
                Comp.focusElmId = null;
                // Log.log("document.body.click target.id=" + target.id);
            }, false);

            document.body.addEventListener("focusin", (e: any) => {
                // Log.log("focusin id=" + e.target.id);
                this.currentFocusId = e.target.id;
            });

            // This is a cool way of letting CTRL+UP, CTRL+DOWN scroll to next node. WARNING: even
            // with tabIndex added none of the other DIVS react renders seem to be able to accept an
            // onKeyDown event. Todo: before enabling this need to make sure 1) the Main Tab is
            // selected and 2) No Dialogs are Open, because this WILL capture events going to
            // dialogs / edit fields
            document.body.addEventListener("keydown", (event: KeyboardEvent) => {
                let ast = getAs();

                switch (event.code) {
                    case "ControlLeft":
                        this.ctrlKey = true;
                        this.ctrlKeyTime = new Date().getTime();
                        break;
                    case "Escape":
                        if (S.util.fullscreenViewerActive()) {
                            S.nav._closeFullScreenViewer();
                        }
                        break;

                    // case "ArrowDown":
                    //     if (this.keyDebounce()) return;
                    //     ast = getAst()
                    //     S.view.scrollRelativeToNode("down", ast);
                    //     break;

                    // case "ArrowUp":
                    //     if (this.keyDebounce()) return;
                    //     ast = getAst()
                    //     S.view.scrollRelativeToNode("up", ast);
                    //     break;

                    case "ArrowLeft":
                        if (this.keyDebounce()) return;
                        // S.nav.navUpLevel();
                        if (ast.fullScreenConfig.type === FullScreenType.IMAGE) {
                            S.nav._prevFullScreenImgViewer();
                        }
                        break;

                    case "ArrowRight":
                        if (this.keyDebounce()) return;
                        ast = getAs();
                        // S.nav.navOpenSelectedNode(state);
                        if (ast.fullScreenConfig.type === FullScreenType.IMAGE) {
                            S.nav._nextFullScreenImgViewer();
                        }
                        break;

                    default: break;
                }
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
        }, 100);
    }

    keyDebounce() {
        const now = S.util.currentTimeMillis();
        // allow one operation every quarter second.
        if (Quanta.lastKeyDownTime > 0 && now - Quanta.lastKeyDownTime < 250) {
            return true;
        }
        Quanta.lastKeyDownTime = now;
        return false;
    }

    /* The overlayCounter allows recursive operations which show/hide the overlay to happen such
    that if something has already shown the overlay and not hidden it yet, then any number of
    'sub-processes' (functionality) cannot distrupt the proper state. This is just the standard sort
    of 'reference counting' sort of algo here. Note that we initialize the counter to '1' and not
    zero since the overlay is initially visible so that's the correct counter state to start with.
    */
    static overlayCounter: number = 1; // this starting value is important.
    setOverlay(showOverlay: boolean) {
        Quanta.overlayCounter += showOverlay ? 1 : -1;

        /* if overlayCounter goes negative, that's a mismatch */
        if (Quanta.overlayCounter < 0) {
            throw new Error("Overlay calls are mismatched");
        }

        if (Quanta.overlayCounter === 1) {

            /* Whenever we are about to show the overlay always give the app 0.7 seconds before
            showing the overlay in case the app did something real fast and the display of the
            overlay would have just been a wasted annoyance (visually) and just simply caused a bit
            of unnecessary eye strain
            */
            setTimeout(() => {
                // after the timer we check for the counter still being greater than zero (not an ==1 this time).
                if (Quanta.overlayCounter > 0) {
                    const elm = S.domUtil.domElm("overlayDiv");
                    if (elm) {
                        elm.style.display = "block";
                        elm.style.cursor = "wait";
                    }
                }
            }, 1200);
        }
        else if (Quanta.overlayCounter === 0) {
            const elm = S.domUtil.domElm("overlayDiv");
            if (elm) {
                elm.style.display = "none";
            }
        }
    }
}
