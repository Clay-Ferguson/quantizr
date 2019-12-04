console.log("SearchIntf.ts");

import * as I from "../Interfaces";

export interface GraphIntf {
    graphTreeStructure(): any;
    graphNodesResponse(res: I.GraphResponse): any;
}

