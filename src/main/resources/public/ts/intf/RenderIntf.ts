
import * as J from "../JavaIntf";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";
import { TypeHandlerIntf } from "./TypeHandlerIntf";
import { AppState } from "../AppState";

export interface RenderIntf {
    lastOwner: string;

    setNodeDropHandler(rowDiv: Comp, node: J.NodeInfo, state: AppState): void;
    initMarkdown(): void;
    injectSubstitutions(content: string): string;
    showNodeUrl(state: AppState): void;
    renderPageFromData(data: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean, state: AppState): Promise<void>;
    getUrlForNodeAttachment(node: J.NodeInfo): string;
    getStreamUrlForNodeAttachment(node: J.NodeInfo): string;
    makeAvatarImage(node: J.NodeInfo): Img;
    allowPropertyToDisplay(propName: string): boolean;
    allowPropertyEdit(node: J.NodeInfo, propName: string, state: AppState): boolean;
    isReadOnlyProperty(propName: string): boolean;
    allowAction(typeHandler: TypeHandlerIntf, action: string): boolean; 
    createBetweenNodeButtonBar(node: J.NodeInfo, isFirst: boolean, isLastOnPage: boolean, nodesToMove: string[], state: AppState): Comp;
    renderChildren(node: J.NodeInfo, level: number, allowNodeMove: boolean): Comp;
}
