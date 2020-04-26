
import * as J from "../JavaIntf";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";
import { TypeHandlerIntf } from "./TypeHandlerIntf";

export interface RenderIntf {
    lastOwner: string;

    setNodeDropHandler(rowDiv: Comp, node: J.NodeInfo): void;
    initMarkdown(): void;
    resetTreeDom(): void;
    updateHighlightNode(node: J.NodeInfo): void;
    injectSubstitutions(content: string): string;
    showNodeUrl(): void;
    renderPageFromData(data?: J.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string, clickTab?: boolean): Promise<void>;
    getUrlForNodeAttachment(node: J.NodeInfo): string;
    getStreamUrlForNodeAttachment(node: J.NodeInfo): string;
    makeAvatarImage(node: J.NodeInfo): Img;
    allowPropertyToDisplay(propName: string): boolean;
    allowPropertyEdit(node: J.NodeInfo, propName: string): boolean;
    isReadOnlyProperty(propName: string): boolean;
    allowAction(typeHandler: TypeHandlerIntf, action: string): boolean; 
    createBetweenNodeButtonBar(node: J.NodeInfo, isFirst: boolean, isLastOnPage: boolean): Comp;
    renderChildren(node: J.NodeInfo, newData: boolean, level: number, allowNodeMove: boolean): Comp;
}
