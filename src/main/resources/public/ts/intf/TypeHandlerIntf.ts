console.log("TypeHandleIntf.ts");

import * as I from "../Interfaces";
import { Comp } from "../widget/base/Comp";


export interface TypeHandlerIntf {
    render(node: I.NodeInfo, rowStyling: boolean): Comp;
    orderProps(node: I.NodeInfo, _props: I.PropertyInfo[]): I.PropertyInfo[];
    getIconClass(node : I.NodeInfo): string;
    allowAction(action : string): boolean;
}