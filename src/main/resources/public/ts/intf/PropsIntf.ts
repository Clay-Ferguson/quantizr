import * as J from "../JavaIntf";
import { PropTable } from "../widget/PropTable";
import { AppState } from "../AppState";

export interface PropsIntf {
    simpleModePropertyBlackList: any;
    readOnlyPropertyList: any;
    controlBasedPropertyList: any;

    initConstants(): void;
    orderProps(propOrder: string[], _props: J.PropertyInfo[]): J.PropertyInfo[];
    moveNodePosition(props: J.PropertyInfo[], idx: number, typeName: string): number;
    propsToggle(state: AppState): void;
    deleteProp(node: J.NodeInfo, propertyName : string): void;
    renderProperties(properties : J.PropertyInfo[]): PropTable;
    getNodeProp(propertyName: string, node: J.NodeInfo): J.PropertyInfo;
    getNodePropVal(propertyName : string, node: J.NodeInfo): string;
    setNodePropVal(propertyName : string, node: J.NodeInfo, val: string): void;
    setNodeProp(node: J.NodeInfo, newProp: J.PropertyInfo): void;
    isEncrypted(node: J.NodeInfo): boolean;
    isShared(node: J.NodeInfo): boolean;
    isPublic(node: J.NodeInfo): boolean;
    isMine(node: J.NodeInfo, state: AppState): boolean;
    hasBinary(node: J.NodeInfo): boolean;
    hasImage(node: J.NodeInfo): boolean;
    hasAudio(node: J.NodeInfo): boolean;
    hasVideo(node: J.NodeInfo): boolean;
    getCryptoKey(node: J.NodeInfo, state: AppState): string;
}
