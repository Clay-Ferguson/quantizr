import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";

/* root react Redux state for entire app */
export class AppState {
    title: string = "";

    node: J.NodeInfo;
    endReached: boolean;

    searchResults: NodeInfo[];
    timelineResults: NodeInfo[];

    /* Node Ids to move */
    nodesToMove: string[];

    mstate = {
        selNodeCount: 0,
        highlightNode: null,
        selNodeIsMine: false,
        homeNodeSelected: false,
        importFeatureEnabled: false,
        exportFeatureEnabled: false,
        highlightOrdinal: 0,
        numChildNodes: 0,
        canMoveUp: false,
        canMoveDown: false,
        canCreateNode: false,
        propsToggle: false,
        allowEditMode: false
    };
}
