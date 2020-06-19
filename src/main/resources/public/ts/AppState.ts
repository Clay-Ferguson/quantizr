import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";

/* root react Redux state for entire app */
export class AppState {
    //for testing in AppDemo
    counter: number = 0; 
    compDemoIdActive: number = -1;

    /* name of currently logged in user */
    userName: string = J.PrincipalName.ANON;
    //userBio: string;

    offsetOfNodeFound: number;
    displayedParent: boolean;
    title: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    timelineResults: NodeInfo[];
    feedResults: NodeInfo[];

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = null; 

    userPreferences: J.UserPreferences = {
        editMode: false,
        importAllowed: false,
        exportAllowed: false,
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

    /* Flag that indicates if we are rendering owner, modTime, etc. on each row */
    showMetaData: boolean;

    allowFileSystemSearch: boolean;
    anonUserLandingPageNode: any;

    homeNodeId: string;
    homeNodePath: string;

    pendingLocationHash: string;

    /* Keeds track of which nodes the user has clicked to expand */
    expandedImages = {};

    //Rss feeds
    feedCache = {};
    failedFeedCache = {};
}
