import clientInfo from "./ClientInfo";
import { Constants as C } from "./Constants";
import { DialogBase } from "./DialogBase";
import { NodeHistoryItem } from "./HistoryUtil";
import { FullScreenConfig, FullScreenType } from "./Interfaces";
import { TabBase } from "./intf/TabBase";
import * as J from "./JavaIntf";
import { NodeInfo, PrincipalName } from "./JavaIntf";
import { Tour } from "./Tour";

export interface ExportSettings {
    exportType: string;
    includeToc?: boolean;
    includeMetaComments?: boolean;
    contentType?: string; // html, md, json
    includeIDs?: boolean;
    dividerLine?: boolean;
    updateHeadings?: boolean;
    includeOwners?: boolean;
}

export class AppState {
    constructor() {
        console.log("Constructing AppState");
    }

    // this will be true only if screen width greater than 1024px. In desktop mode we have the RHS
    // panel in a popup, and if this var is false that means we're allowing the RHS only in this
    // popup panel that can be triggered by the sitemap button on the upper left. For mobile mode
    // this is always true.
    showRhs = true;

    appInitComplete = false;
    tabPanelVisible: boolean = true;
    stateId: number = 0;
    displayFeedSearch: boolean = false;
    docIndent: boolean = false;
    docImages: boolean = true;

    mobileMode: boolean = clientInfo.isMobileOrTablet;
    // mobileMode: boolean = true;

    dialogStack: DialogBase[] = [];

    /* text at top of page, when user tries to upLevel too far etc */
    pageMessage: string = null;

    /* This allows us to detect when we're rendering the main page so we can set it to hidden
    visibilty until the scrolling has been done, or else we can get a bad flicker effect when page
    renders at wrong scroll position and then scrolls while the user is watching. With this flag it
    helps us just pop up instantly to the correct content AND scrolled to exactly where we want it.
    */
    rendering: boolean = false;

    otherAccountNodesExpanded: boolean = false;
    linksToAttachmentsExpanded: boolean = false;
    searchTipsExpanded: boolean = false;
    tagTipsExpanded: boolean = false;
    aiPromptsExpanded: boolean = false;

    /* name of currently logged in user */
    userName: string = PrincipalName.ANON;
    displayName: string = "";

    node: NodeInfo;
    highlightNodeId: string = null;

    // if this is non-null when we ask a question with the "AI Ask", button AND we are on the
    // ThreadView tab then we know that after the node is answered we take the anwser and append it
    // to the threadview results and refresh via dispatch
    threadViewQuestionId: string = null;

    indexHighlightNode: string = null;
    endReached: boolean;

    /* Node Ids to move */
    nodesToMove: string[];
    cutCopyOp: string = null; // cut | copy

    activeTab: string = null;
    savedActiveTab: string = null;

    /* data for each tab, which we DO want to keep separate from the GUI view components themselves
    */
    tabData: TabBase[] = [];

    // null means we haven't read the yet and the server will get them as needed.
    friendHashTags: string[] = null;

    // This determines what thing is being displayed fullscreen, and can only be one thing at a
    // time.
    fullScreenConfig: FullScreenConfig = { type: FullScreenType.NONE };

    graphSearchText: string = null;
    highlightText: string = null;
    calendarData: J.CalendarItem[];
    calendarShowWeekends: boolean = false;

    fullScreenImageSize: string = C.FULL_SCREEN_MAX_WIDTH;

    speechPaused: boolean = false;
    speechSpeaking: boolean = false;
    speechVoice: number = -1; // index into speech.voices array (-1 means not set)
    speechVoice2: number = -1; // index into speech.voices array (-1 means not set)
    speechRate: string = "normal"; // slow, normal, fast
    ttsRan: boolean = false;
    showTtsInputText: boolean = false;

    // if the URL is like 'https://quanta.wiki' and no path or query on the url then default
    // to showing this LHS menu always.
    anonShowLHSMenu: boolean = (!window.location.pathname || window.location.pathname.length == 1) && !window.location.search;
    showSchemaOrgProps: boolean = false;
    showRecentProps: boolean = false;

    timelineReversedOrder: boolean = false;

    userPrefs: J.UserPreferences = {
        editMode: false,
        aiMode: J.Constant.AI_MODE_CHAT,
        showMetaData: false,
        showProps: false,
        autoRefreshFeed: false, // #add-prop
        showReplies: true,
        rssHeadlinesOnly: true,
        maxUploadFileSize: 0,
        mainPanelCols: 6,
        aiService: J.AIModel.OPENAI,
        aiAgentFileExtensions: "txt,md,html,htm,java,js,css,ts,tsx,py,sh,sql,json,yaml,yml,xml,properties,ini,conf,config,env,log,mdx,jsx,tsx,graphql,mdx,md,markdown",
        aiAgentFoldersToInclude: "",
        aiMaxWords: 1000,
        aiTemperature: 0.7,
    };

    exportSettings: ExportSettings = {
        exportType: "zip",
        includeToc: false,
        includeMetaComments: false,
        contentType: "md", // html, md, json
        includeIDs: false,
        dividerLine: false,
        updateHeadings: false,
        includeOwners: false
    };

    userProfile: J.UserProfile = null;

    myNewMessageCount: number = 0;

    // ids of selected nodes
    selectedNodes: Set<string> = new Set<string>();
    expandedCollapsibles: Set<string> = new Set<string>();
    highlightSearchNodeId: string;

    nodeClickedToDel: string;
    nodesToDel: string[];

    isAdminUser: boolean;
    isAnonUser: boolean = true;
    allowBashScripting: boolean;

    allowFileSystemSearch: boolean;
    anonUserLandingPageNode: string;

    // Rss feeds (cached by a hash of the feedSrc property text as the key)
    rssFeedCache = {};
    rssProgressText: string = null;

    // Similar to feedCache but holds the current 'page' the user is on (1, 2, 3,...) based on the user
    // being able to click 'more...' button to page thru a feed.
    rssFeedPage = {};

    // non-null if user is viewing an RSS feed and this will be the actual feed node
    rssNode: NodeInfo = null;

    bookmarks: J.Bookmark[];
    tour: Tour;

    editNode: NodeInfo;
    afterEditJumpToId: string;

    editNodeReplyToId: string;
    editShowJumpButton: boolean;
    editEncrypt: boolean;
    serverInfoText: string = null;
    showNodeLinksInGraph: boolean = true;
    attractionLinksInGraph: boolean = true;

    // holds nodeId of the current conversation thread leaf node. The one the thread view was
    // 'executed' on.
    threadViewFromNodeId: string = null;

    // when we open the Thread View we record here what Tab we were on so that the "Go back", button
    // can switch to it.
    threadViewFromTab: string = null;

    searchViewFromNode: NodeInfo = null; // rename to searchViewFromNode

    // when we open the Thread View we record here what Tab we were on so that the "Go back", button
    // can switch to it.
    searchViewFromTab: string = null;

    repliesViewNodeId: string = null;
    repliesViewFromTab: string = null;

    serverInfoCommand: string = null;
    serverInfoTitle: string = null;

    graphData: J.GraphNode;

    morePanelExpanded: boolean;
    propsPanelExpanded: boolean;

    // When this is on null it means user is in the process of linking two nodes, and we're ready
    // for them to select the target node to finish linking the linkSource to the target node
    linkSource: string = null;

    nodeHistory: NodeHistoryItem[] = [];
    nodeHistoryLocked: boolean;

    expandedMenus: Set<string> = new Set<string>();

    menuIndexToggle: string = "menu";
    showGptCredit: boolean = false;

    // when we 'cut' attachments this is the ID of the node we cut them from
    cutAttachmentsFromId: string;
    // this is the set of attachment keys that were cut
    cutAttachments: Set<string>;

    statsNodeId: string = null;
}
