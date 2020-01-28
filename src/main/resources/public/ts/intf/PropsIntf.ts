import * as I from "../Interfaces";
import { PropTable } from "../widget/PropTable";

export interface PropsIntf {
    orderProps(propOrder: string[], _props: I.PropertyInfo[]): I.PropertyInfo[];
    moveNodePosition(props: I.PropertyInfo[], idx: number, typeName: string): number;
    propsToggle(): void;
    deleteProperty(node: I.NodeInfo, propertyName : string): void;
    getPropertiesInEditingOrder(node: I.NodeInfo, _props: I.PropertyInfo[]): I.PropertyInfo[];
    renderProperties(properties : I.PropertyInfo[]): PropTable;
    getNodeProperty(propertyName: string, node: I.NodeInfo): I.PropertyInfo;
    getNodePropertyVal(propertyName : string, node: I.NodeInfo): string;
    setNodePropertyVal(propertyName : string, node: I.NodeInfo, val: string): void;
    renderProperty(property : I.PropertyInfo): string;
}
