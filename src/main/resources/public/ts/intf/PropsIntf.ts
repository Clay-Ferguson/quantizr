import * as J from "../JavaIntf";
import { PropTable } from "../widget/PropTable";

export interface PropsIntf {
    orderProps(propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[];
    moveNodePosition(props: J.PropertyInfo[], idx: number, typeName: string): number;
    propsToggle(): void;
    deleteProp(node: J.NodeInfo, propertyName : string): void;
    renderProperties(properties : J.PropertyInfo[]): PropTable;
    getNodeProp(propertyName: string, node: J.NodeInfo): J.PropertyInfo;
    getNodePropVal(propertyName : string, node: J.NodeInfo): string;
    setNodePropVal(propertyName : string, node: J.NodeInfo, val: string): void;
    isEncrypted(node: J.NodeInfo): boolean;
    isShared(node: J.NodeInfo): boolean;
    isPublic(node: J.NodeInfo): boolean;
    isMine(node: J.NodeInfo): boolean;
    hasBinary(node: J.NodeInfo): boolean;
    hasImage(node: J.NodeInfo): boolean;
    hasAudio(node: J.NodeInfo): boolean;
    getCryptoKey(node: J.NodeInfo): string;
}
