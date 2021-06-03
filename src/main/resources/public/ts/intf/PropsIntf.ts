import { AppState } from "../AppState";
import * as J from "../JavaIntf";
import { PropTable } from "../widget/PropTable";

export interface PropsIntf {
    allBinaryProps: Set<string>;
    readOnlyPropertyList: Set<string>;
    controlBasedPropertyList: Set<string>;

    initConstants(): void;
    orderProps(propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[];
    moveNodePosition(props: J.PropertyInfo[], idx: number, typeName: string): number;
    propsToggle(state: AppState): void;
    deleteProp(node: J.NodeInfo, propertyName : string): void;
    renderProperties(properties : J.PropertyInfo[]): PropTable;
    getNodeProp(propertyName: string, node: J.NodeInfo): J.PropertyInfo;
    getClientProp(propertyName: string, node: J.NodeInfo): J.PropertyInfo;
    getNodePropVal(propertyName : string, node: J.NodeInfo): string;
    getClientPropVal(propertyName : string, node: J.NodeInfo): string;
    setNodePropVal(propertyName : string, node: J.NodeInfo, val: string): void;
    setNodeProp(node: J.NodeInfo, newProp: J.PropertyInfo): void;
    isEncrypted(node: J.NodeInfo): boolean;
    isShared(node: J.NodeInfo): boolean;
    isPublic(node: J.NodeInfo): boolean;
    isPublicWritable(node: J.NodeInfo): boolean;
    isPublicReadOnly(node: J.NodeInfo): boolean;
    getAcCount(node: J.NodeInfo): number;
    hasPrivilege(ace: J.AccessControlInfo, priv: string): boolean;
    isMine(node: J.NodeInfo, state: AppState): boolean;
    hasBinary(node: J.NodeInfo): boolean;
    hasImage(node: J.NodeInfo): boolean;
    hasAudio(node: J.NodeInfo): boolean;
    hasVideo(node: J.NodeInfo): boolean;
    getCryptoKey(node: J.NodeInfo, state: AppState): string;
    transferBinaryProps(srcNode: J.NodeInfo, dstNode: J.NodeInfo): void;
    getInputClassForType(typeName: string): string;
}
