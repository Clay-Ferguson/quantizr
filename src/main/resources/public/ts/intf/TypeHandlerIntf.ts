import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Comp } from "../widget/base/Comp";

export interface TypeHandlerIntf {
    render(node: J.NodeInfo, rowStyling: boolean): Comp;
    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[];
    getIconClass(node : J.NodeInfo): string;
    allowAction(action : string): boolean;
}