import { AppState } from "../AppState";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { TabDataIntf } from "./TabDataIntf";

/* This interface is how Type Plugins are handled */
export interface TypeHandlerIntf {
    getTypeName(): string;
    getName(): string;
    render(node: J.NodeInfo, tabData: TabDataIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp;
    getIconClass(): string;
    allowAction(action : NodeActionType, node: J.NodeInfo, appState: AppState): boolean;
    getAllowRowHeader(): boolean;
    allowPropertyEdit(typeName: string, state: AppState): boolean;
    getDomPreUpdateFunction(parent: CompIntf): void;
    getCustomProperties(): string[];
    ensureDefaultProperties(node: J.NodeInfo);
    getAllowPropertyAdd(): boolean;
    getAllowContentEdit(): boolean;
    getEditLabelForProp(propName: string): string;
    getEditorRowsForProp(propName: string): number;
    getAllowUserSelect(): boolean;
    hasCustomProp(prop: string): boolean;
    getEditorHelp(): string;
    isSpecialAccountNode(): boolean;

    // for sorting on client side (namely for items packaged in a collapsable panel on account root page.)
    subOrdinal(): number;
}
