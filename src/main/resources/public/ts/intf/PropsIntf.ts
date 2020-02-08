import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { PropTable } from "../widget/PropTable";

export interface PropsIntf {
    orderProps(propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[];
    moveNodePosition(props: J.PropertyInfo[], idx: number, typeName: string): number;
    propsToggle(): void;
    deleteProperty(node: J.NodeInfo, propertyName : string): void;
    renderProperties(properties : J.PropertyInfo[]): PropTable;
    getNodeProperty(propertyName: string, node: J.NodeInfo): J.PropertyInfo;
    getNodePropertyVal(propertyName : string, node: J.NodeInfo): string;
    setNodePropertyVal(propertyName : string, node: J.NodeInfo, val: string): void;
}
