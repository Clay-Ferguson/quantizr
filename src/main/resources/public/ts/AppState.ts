import { EventInput } from "@fullcalendar/react";
import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { FullScreenConfig, FullScreenType } from "./Interfaces";
import { TabIntf } from "./intf/TabIntf";
import * as J from "./JavaIntf";

export class AppState {
    constructor() {
        console.log("Constructing AppState");
    }

    tabPanelVisible: boolean = true;
    stateId: number = 0;
    displayFeedSearch: boolean = false;
    docIndent: boolean = true;

    // todo-1: need to assign something like 'config.props' as an actual TYPED thing, for type safety, and then
    // only in the place where we load this config value, extract that into the typed property
    // Initialize to empty object so we don't get NPE
    config: any = {};

    // up until guiReady the main App component will just render "loading..."
    // todo-0: this can fail to get set on startup if not everything goes well
    // and we need to be more resilient and not allow that EVER.
    guiReady: boolean = false;

    mobileMode: boolean = clientInfo.isMobileOrTablet;

    // show the ipfsTab to any users, even users without their MFS Files option turned on in their user profile
    // showIpfsTab: boolean;

    dialogStack: DialogBase[] = [];

    /* text at top of page, when user tries to upLevel too far etc */
    pageMessage: string = null;

    /* This allows us to detect when we're rendering the main page so we can set it to hidden visibilty until the scrolling
    has been done, or else we can get a bad flicker effect when page renders at wrong scroll position and then scrolls
    while the user is watching. With this flag it helps us just pop up instantly to the correct content AND scrolled to exactly
    where we want it.
    */
    rendering: boolean = false;

    otherAccountNodesExpanded: boolean = false;
    linksToAttachmentsExpanded: boolean = false;

    inlineEditId: string;
    inlineEditVal: string;

    /* name of currently logged in user */
    userName: string = J.PrincipalName.ANON;
    displayName: string = "";

    node: J.NodeInfo;
    highlightNodeId: string = null;
    endReached: boolean;

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = null;

    /* data for each tab, which we DO want to keep separate from the GUI view components themselves */
    tabData: TabIntf[] = [];

    // This determines what thing is being displayed fullscreen, and can only be one thing at a time.
    fullScreenConfig: FullScreenConfig = { type: FullScreenType.NONE };

    graphSearchText: string = null;

    calendarData: EventInput[];
    calendarShowWeekends: boolean = false;

    fullScreenImageSize: string = C.FULL_SCREEN_MAX_WIDTH;

    /* holds array of all parent items all the way up the tree (as far as user is authorized) */
    breadcrumbs: J.BreadcrumbInfo[];

    mouseEffect: boolean = false;

    userPrefs: J.UserPreferences = {
        editMode: false,
        showMetaData: false,
        nsfw: false,
        showParents: false,
        showReplies: true,
        rssHeadlinesOnly: true,
        maxUploadFileSize: 0,
        enableIPSM: false,
        mainPanelCols: 6
    };

    userProfile: J.UserProfile = null;
    newMessageCount: number = 0;

    // ids of selected nodes
    selectedNodes: Set<string> = new Set<string>();
    expandedHeaderIds: Set<string> = new Set<string>();

    highlightSearchNodeId: string;

    isAdminUser: boolean;
    isAnonUser: boolean = true;
    allowBashScripting: boolean;
    allowedFeatures: string;

    /*
     * toggled by button, and holds if we are going to show properties or not on each node in the main view
     */
    showProperties: boolean;

    allowFileSystemSearch: boolean;
    anonUserLandingPageNode: any;

    // UserAccount node ID (todo-0: rename these to 'accnt' not 'home')
    homeNodeId: string;
    homeNodePath: string;

    pendingLocationHash: string;

    // Rss feeds (cached by a hash of the feedSrc property text as the key)
    rssFeedCache = {};

    // Similar to feedCache but holds the current 'page' the user is on (1, 2, 3,...) based on the user
    // being able to click 'more...' button to page thru a feed.
    rssFeedPage = {};

    bookmarks: J.Bookmark[];
    editNode: J.NodeInfo;
    editNodeOnTab: string; // holds the tab name of the tab responsible for any current embed edit of 'editNode'
    editNodeReplyToId: string;
    editShowJumpButton: boolean;
    editEncrypt: boolean;
    serverInfoText: string = null;

    // holds nodeId of the current conversation thread leaf node. The one the thread view was 'executed' on.
    threadViewNodeId: string = null;

    serverInfoCommand: string = null;
    serverInfoTitle: string = null;

    ipsmActive: boolean = false;

    graphData: J.GraphNode;
}
