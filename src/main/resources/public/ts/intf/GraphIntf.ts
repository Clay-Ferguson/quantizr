import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface GraphIntf {
    graphTreeStructure(): any;
    graphNodesResponse(res: J.GraphResponse): any;
}

