import * as J from "../JavaIntf";
import { Comp } from "../widget/base/Comp";

/* This interface is how Type Plugins are handled */
export interface TypeHandlerIntf {
    getTypeName(): string;
    render(node: J.NodeInfo, rowStyling: boolean): Comp;
    getIconClass(node : J.NodeInfo): string;
    allowAction(action : string): boolean;
    allowPropertyEdit(typeName: string): boolean;
}