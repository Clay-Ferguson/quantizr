import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";
import { EventInput } from "@fullcalendar/react";

/* root react Redux state for entire app */
export class AppState {
    // up until guiReady the main App component will just render "loading..."
    guiReady: boolean = false;

    /* This allows us to detect when we're rendering the main page so we can set it to hidden visibilty until the scrolling
    has been done, or else we can get a bad flicker effect when page renders at wrong scroll position and then scrolls
    while the user is watching. With this flag it helps us just pop up instantly to the correct content AND scrolled to exactly
    where we want it. */
    rendering: boolean = false;

    /* flag that indicates the user can click "Refresh Feed" because there are new changes read */
    feedDirty: boolean = false;

    inlineEditId: string;
    inlineEditVal: string;

    // for testing in AppDemo
    counter: number = 0;
    compDemoIdActive: number = -1;

    /* name of currently logged in user */
    userName: string = J.PrincipalName.ANON;

    title: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    timelineResults: NodeInfo[];
    feedResults: NodeInfo[];

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = null;

    // When the user clicks an image, we switch to a fullscreen viewer for that image, at max size of the display, and any time
    // this nodeId is non-null we are displaying that FullScreenView comp, which occupies everything below the toolbar.
    fullScreenViewId: string = null;
    fullScreenGraphId: string = null;
    fullScreenCalendarId: string = null;

    calendarData: EventInput[];
    calendarShowWeekends: boolean = false;

    fullScreenImageSize: string = "100%";

    /* holds array of all parent items all the way up the tree (as far as user is authorized) */
    breadcrumbs: J.BreadcrumbInfo[];

    userPreferences: J.UserPreferences = {
        editMode: false,
        showMetaData: false,
        maxUploadFileSize: 0
    };

    /*
    * maps all node uids to true if selected, otherwise the property should be deleted (not existing)
   todo-1: Javascript has a Set object we can use in cases like this!
   new Set([1, 2, 3]).forEach(el => {
       console.log(el * 2);
   });
    */
    // todo-1: implement this as Set<string>
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

    homeNodeId: string;
    homeNodePath: string;

    pendingLocationHash: string;

    // Rss feeds
    feedCache = {};
}
