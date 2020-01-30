import * as I from "../Interfaces";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";
import { Comp } from "../widget/base/Comp";

export interface RenderIntf {
    buildRowHeader(node: I.NodeInfo, showPath: boolean, showName: boolean): Div;
    injectSubstitutions(content: string): string;
    renderNodeContent(node: I.NodeInfo, showPath, showName, renderBin, rowStyling, showHeader): Comp[];
    renderMarkdown(rowStyling: boolean, node: I.NodeInfo, retState: any): Comp;
    renderNodeAsListItem(node: I.NodeInfo, index: number, count: number, rowCount: number, level: number, layoutClass: string): Comp;
    showNodeUrl(): void;
    getTopRightImageTag(node: I.NodeInfo): Img;
    getNodeBkgImageStyle(node: I.NodeInfo): string;
    //centeredButtonBar(buttons: Comp[], classes?: string): Comp;
    makeRowButtonBar(node: I.NodeInfo, editingAllowed: boolean): Comp;
    makeHorizontalFieldSet(content: Comp[], extraClasses?: string): Comp;
    nodeHasChildren(id: string): boolean;
    renderPageFromData(data?: I.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string): Promise<void>;
    firstPage(): void;
    prevPage(): void;
    nextPage(): void;
    lastPage(): void;
    generateRow(i: number, node: I.NodeInfo, newData: boolean, childCount: number, rowCount: number, level: number, layoutClass: string): Comp;
    getUrlForNodeAttachment(node: I.NodeInfo): string;
    makeImageTag(node: I.NodeInfo): Img;
    allowPropertyToDisplay(propName: string): boolean;
    isReadOnlyProperty(propName: string): boolean;
    isBinaryProperty(propName: string): boolean;
    sanitizePropertyName(propName: string): string;
    setImageMaxWidths(): void;
}
