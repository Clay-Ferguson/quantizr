
import * as J from "../JavaIntf";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";
import { TypeHandlerIntf } from "./TypeHandlerIntf";
import { AppState } from "../AppState";
import { NodeActionType } from "../enums/NodeActionType";

export interface RenderIntf {
    lastOwner: string;
    fadeInId: string;

    setNodeDropHandler(rowDiv: Comp, node: J.NodeInfo, state: AppState): void;
    initMarkdown(): void;
    injectSubstitutions(content: string): string;
    showNodeUrl(node: J.NodeInfo, state: AppState): void;
    renderPageFromData(data: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean, allowScroll: boolean, state: AppState): void; 
    getUrlForNodeAttachment(node: J.NodeInfo): string;
    getStreamUrlForNodeAttachment(node: J.NodeInfo): string;
    makeAvatarImage(node: J.NodeInfo, state: AppState): Img;
    allowPropertyEdit(node: J.NodeInfo, propName: string, state: AppState): boolean;
    isReadOnlyProperty(propName: string): boolean;
    allowAction(typeHandler: TypeHandlerIntf, action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean; 
    createBetweenNodeButtonBar(node: J.NodeInfo, isFirst: boolean, isLastOnPage: boolean, state: AppState): Comp;
    renderChildren(node: J.NodeInfo, level: number, allowNodeMove: boolean): Comp;
    getAvatarImgUrl(ownerId: string, avatarVer: string): string;
}
