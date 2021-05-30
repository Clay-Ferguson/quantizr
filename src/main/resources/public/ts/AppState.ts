import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { EventInput } from "@fullcalendar/react";
import { DialogBase } from "./DialogBase";
import { ProfileState } from "./comps/ProfileState";
import clientInfo from "./ClientInfo";

/* root react Redux state for entire app */
export class AppState {
    // up until guiReady the main App component will just render "loading..."
    guiReady: boolean = false;
    mobileMode: boolean = clientInfo.isMobileOrTablet;

    dialogStack: DialogBase[] = [];

    /* text at top of page, when user tries to upLevel too far etc */
    pageMessage: string = null;

    /* This allows us to detect when we're rendering the main page so we can set it to hidden visibilty until the scrolling
    has been done, or else we can get a bad flicker effect when page renders at wrong scroll position and then scrolls
    while the user is watching. With this flag it helps us just pop up instantly to the correct content AND scrolled to exactly
    where we want it.

    UPDATE: This flag works as intended but it turns out blanking the screen while it prepares it at the new
    scroll position is MORE visually annoying then watching the scroll change. Perhaps I've improved rendering so much
    since this was first written that things are totally different now, but regardless, I'm leaving this code in place but
    it's ignored for now, by having meta64.hiddenRenderingEnabled=false.
    */
    rendering: boolean = false;

    /* flag that indicates the user can click "Refresh" because there are new changes read */
    feedDirty: boolean = false;
    feedLoading: boolean = false;

    inlineEditId: string;
    inlineEditVal: string;

    // for testing in AppDemo
    counter: number = 0;
    compDemoIdActive: number = -1;

    /* name of currently logged in user */
    userName: string = J.PrincipalName.ANON;

    feedFilterFriends: boolean = false;
    feedFilterToMe: boolean = false;
    feedFilterFromMe: boolean = false;

    feedFilterToPublic: boolean = true;
    feedFilterLocalServer: boolean = false;

    // must be true to allow NSFW materials.
    feedFilterNSFW: boolean = true;

    // when true indicates the Feed will show "Refresh when ready..." and not display data
    // until user has set their checkboxes and clicks "Refresh Feed" button.
    feedWaitingForUserRefresh: boolean = true;

    // todo-1: need to rename 'title', actually holds userName
    title: string = "";
    displayName: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    searchDescription: string;
    searchNode: J.NodeInfo;

    isUserSearch: boolean = false;

    timelineResults: NodeInfo[];
    timelineDescription: string;
    timelineNode: J.NodeInfo;

    feedResults: NodeInfo[];
    feedEndReached: boolean = false;

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = null;

    // When the user clicks an image, we switch to a fullscreen viewer for that image, at max size of the display, and any time
    // this nodeId is non-null we are displaying that FullScreenView comp, which occupies everything below the toolbar.
    fullScreenViewId: string = null;
    fullScreenGraphId: string = null;
    fullScreenCalendarId: string = null;

    graphSearchText: string = null;

    calendarData: EventInput[];
    calendarShowWeekends: boolean = false;

    fullScreenImageSize: string = "100%";

    /* holds array of all parent items all the way up the tree (as far as user is authorized) */
    breadcrumbs: J.BreadcrumbInfo[];

    mouseEffect: boolean = false;

    userPreferences: J.UserPreferences = {
        editMode: false,
        showMetaData: true,
        rssHeadlinesOnly: false,
        maxUploadFileSize: 0
    };

    userProfile: J.UserProfile = null;
    newMessageCount: number = 0;

    selectedNodes: any = {};

    /* maps node.id values to NodeInfo.java objects
    Make this use a Map type (typescript)
    */
    idToNodeMap: Map<string, J.NodeInfo> = new Map<string, J.NodeInfo>();

    isAdminUser: boolean;
    isAnonUser: boolean = true;
    allowBashScripting: boolean;

    /*
     * toggled by button, and holds if we are going to show properties or not on each node in the main view
     */
    showProperties: boolean;

    allowFileSystemSearch: boolean;
    anonUserLandingPageNode: any;

    // UserAccount node ID
    homeNodeId: string;
    homeNodePath: string;

    pendingLocationHash: string;

    // Rss feeds (cached by a hash of the feedSrc property text as the key)
    feedCache = {};

    // Similar to feedCache but holds the current 'page' the user is on (1, 2, 3,...) based on the user
    // being able to click 'more...' button to page thru a feed.
    feedPage = {};
}
