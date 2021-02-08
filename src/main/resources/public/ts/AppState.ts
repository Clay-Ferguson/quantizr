import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { EventInput } from "@fullcalendar/react";

/* root react Redux state for entire app */
export class AppState {
    // up until guiReady the main App component will just render "loading..."
    guiReady: boolean = false;

    /* text at top of page, when user tries to upLevel too far etc */
    pageMessage: string = null;

    /* This allows us to detect when we're rendering the main page so we can set it to hidden visibilty until the scrolling
    has been done, or else we can get a bad flicker effect when page renders at wrong scroll position and then scrolls
    while the user is watching. With this flag it helps us just pop up instantly to the correct content AND scrolled to exactly
    where we want it. */
    rendering: boolean = false;

    /* flag that indicates the user can click "Refresh Feed" because there are new changes read */
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

    // Note: don't default this to 'false' because then Anonymous users don't have a way to change it.
    feedFilterToPublic: boolean = true;

    // must be true to allow NSFW materials.
    feedFilterNSFW: boolean = false;

    // when true indicates the Feed will show "Refresh when ready..." and not display data
    // until user has set their checkboxes and clicks "Refresh Feed" button.
    feedWaitingForUserRefresh: boolean = true;

    title: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    searchDescription: string;
    timelineResults: NodeInfo[];
    feedResults: NodeInfo[];
    feedEndReached: boolean = false;

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = null;

    // When the user clicks an image, we switch to a fullscreen viewer for that image, at max size of the display, and any time
    // this nodeId is non-null we are displaying that FullScreenView comp, which occupies everything below the toolbar.
    fullScreenViewId: string = null;
    fullScreenGraphId: string = null;
    graphSearchText: string = null;
    fullScreenCalendarId: string = null;

    calendarData: EventInput[];
    calendarShowWeekends: boolean = false;

    savedScrollPosition: number = -1;
    fullScreenImageSize: string = "100%";

    /* holds array of all parent items all the way up the tree (as far as user is authorized) */
    breadcrumbs: J.BreadcrumbInfo[];

    userPreferences: J.UserPreferences = {
        editMode: false,
        showMetaData: false,
        maxUploadFileSize: 0
    };

    selectedNodes: any = {};

    /* maps node.id values to NodeInfo.java objects
    Make this use a Map type (typescript)
    */
    idToNodeMap: { [key: string]: J.NodeInfo } = {};

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
}
