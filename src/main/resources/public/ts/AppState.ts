import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";

/* root react Redux state for entire app */
export class AppState {
    /* name of currently logged in user */
    userName: string = J.PrincipalName.ANON;

    offsetOfNodeFound: number;
    displayedParent: boolean;
    noDataResponse: string;
    title: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    timelineResults: NodeInfo[];

    /* Node Ids to move */
    nodesToMove: string[];

    activeTab: string = "mainTab";

    /*
    * Under any given node, there can be one active 'selected' node that has the highlighting, and will be scrolled
    * to whenever the page with that child is re-visited, and parentIdToFocusNodeMap holds the map of "parent id to
    * selected node (NodeInfo object)", where the key is the parent node id, and the value is the currently
    * selected node within that parent. Note this 'selection state' is only significant on the client, and only for
    * being able to scroll to the node during navigating around on the tree.
    */
    parentIdToFocusNodeMap: { [key: string]: J.NodeInfo } = {};

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

    /* maps node.id values to NodeInfo.java objects */
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
}
