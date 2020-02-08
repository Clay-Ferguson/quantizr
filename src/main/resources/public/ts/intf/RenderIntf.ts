import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";

export interface RenderIntf {
    buildRowHeader(node: J.NodeInfo, showPath: boolean, showName: boolean): Div;
    injectSubstitutions(content: string): string;
    renderNodeContent(node: J.NodeInfo, showPath, showName, renderBin, rowStyling, showHeader): Comp[];
    renderMarkdown(rowStyling: boolean, node: J.NodeInfo, retState: any): Comp;
    renderNodeAsListItem(node: J.NodeInfo, index: number, count: number, rowCount: number, level: number, layoutClass: string): Comp;
    showNodeUrl(): void;
    getTopRightImageTag(node: J.NodeInfo): Img;
    getNodeBkgImageStyle(node: J.NodeInfo): string;
    makeRowButtonBar(node: J.NodeInfo, editingAllowed: boolean): Comp;
    makeHorizontalFieldSet(content: Comp[], extraClasses?: string): Comp;
    nodeHasChildren(id: string): boolean;
    renderPageFromData(data?: J.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string): Promise<void>;
    firstPage(): void;
    prevPage(): void;
    nextPage(): void;
    lastPage(): void;
    generateRow(i: number, node: J.NodeInfo, newData: boolean, childCount: number, rowCount: number, level: number, layoutClass: string): Comp;
    getUrlForNodeAttachment(node: J.NodeInfo): string;
    makeImageTag(node: J.NodeInfo): Img;
    allowPropertyToDisplay(propName: string): boolean;
    allowPropertyEdit(node: J.NodeInfo, propName: string): boolean;
    isReadOnlyProperty(propName: string): boolean;
    isBinaryProperty(propName: string): boolean;
    setImageMaxWidths(): void;
}
