import * as I from "../Interfaces";
import * as J from "../JavaIntf";

export interface GraphIntf {
    graphTreeStructure(mstate: any): any;
    graphNodesResponse(res: J.GraphResponse): any;
}

