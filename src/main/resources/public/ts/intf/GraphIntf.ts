import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";

export interface GraphIntf {
    graphTreeStructure(state: AppState): any;
    graphNodesResponse(res: J.GraphResponse): any;
}

