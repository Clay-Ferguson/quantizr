import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";
import { TypeHandlerIntf } from "./TypeHandlerIntf";

export interface RenderIntf {
    resetTreeDom(): void;
    updateHighlightNode(node: J.NodeInfo): void;
    injectSubstitutions(content: string): string;
    renderNodeContent(node: J.NodeInfo, rowStyling: boolean, showHeader: boolean): Comp[];
    renderMarkdown(rowStyling: boolean, node: J.NodeInfo, retState: any): Comp;
    renderNodeAsListItem(node: J.NodeInfo, index: number, count: number, rowCount: number, level: number, layoutClass: string, allowNodeMove: boolean): Comp;
    showNodeUrl(): void;
    getTopRightImageTag(node: J.NodeInfo): Img;
    getNodeBkgImageStyle(node: J.NodeInfo): string;
    renderPageFromData(data?: J.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string, clickTab?: boolean): Promise<void>;
    firstPage(): void;
    prevPage(): void;
    nextPage(): void;
    lastPage(): void;
    generateRow(i: number, node: J.NodeInfo, newData: boolean, childCount: number, rowCount: number, level: number, layoutClass: string, allowNodeMove: boolean): Comp;
    getUrlForNodeAttachment(node: J.NodeInfo): string;
    getStreamUrlForNodeAttachment(node: J.NodeInfo): string;
    makeImageTag(node: J.NodeInfo): Img;
    makeAvatarImage(node: J.NodeInfo): Img;
    allowPropertyToDisplay(propName: string): boolean;
    allowPropertyEdit(node: J.NodeInfo, propName: string): boolean;
    isReadOnlyProperty(propName: string): boolean;
    allowAction(typeHandler: TypeHandlerIntf, action: string): boolean; 
}
