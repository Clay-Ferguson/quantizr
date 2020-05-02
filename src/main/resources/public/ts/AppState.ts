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
}
