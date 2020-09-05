import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface GraphIntf {
    graphTreeStructure(state: AppState): any;
    graphNodesResponse(res: J.GraphResponse): any;
}
