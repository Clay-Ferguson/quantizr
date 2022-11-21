import { AppState } from "../../AppState";
import { Comp } from "../../comp/base/Comp";
import { CompIntf } from "../../comp/base/CompIntf";
import { Div } from "../../comp/core/Div";
import { NodeCompMarkdown } from "../../comp/node/NodeCompMarkdown";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { TabIntf } from "../../intf/TabIntf";
import { NodeActionType, TypeHandlerIntf } from "../../intf/TypeHandlerIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

/* NOTE: Defaults to only allowing 'admin' to edit unless allowPropertyEdit is overridden */
export class TypeBase implements TypeHandlerIntf {

    constructor(public readonly typeName: string, public readonly displayName: string, private iconStyle: string, private allowUserSelect: boolean) {
    }

    getEditorHelp(): string {
        return null;
    }

    getAllowUserSelect(): boolean {
        return this.allowUserSelect;
    }

    renderEditorSubPanel = (node: J.NodeInfo): Comp => {
        return null;
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.DATE) {
            return "Date";
        }
        else if (propName === J.NodeProp.DURATION) {
            return "Duration (HH:MM)";
        }
        return propName;
    }

    getEditorRowsForProp(propName: string): number {
        return 1;
    }

    /* Enables editor to show buttons for adding/deleting custom properties */
    getAllowPropertyAdd(): boolean {
        return true;
    }

    /* Enables editor to control wether content edit textarea shows up in editor dialog */
    getAllowContentEdit(): boolean {
        return true;
    }

    getExtraMarkdownClass(): string {
        return null;
    }

    getAllowRowHeader(): boolean {
        return true;
    }

    getTypeName(): string {
        return this.typeName;
    }

    /* If this returns non-null the editor dialog is expected to show only the enumerated properties for editing

    note: adding NodeProps.CONTENT ('cont') to this (not a genuine property like the rest, is allowed, and it
        means we will be allowing edit of the main node content text
    */
    getCustomProperties(): string[] {
        return null;
    }

    getSelectableProperties(): string[] {
        return null;
    }

    hasCustomProp = (prop: string): boolean => {
        const props = this.getCustomProperties();
        if (!props) return false;
        return !!props.find(p => p === prop);
    }

    hasSelectableProp = (prop: string): boolean => {
        const props = this.getSelectableProperties();
        if (!props) return false;
        return !!props.find(p => p === prop);
    }

    /* Types can override this to ensure that during node editing there is a hook to prefill and create any properties that are
    required to exist on that type of node in case they aren't existing yet */
    ensureDefaultProperties(node: J.NodeInfo) {
    }

    getName(): string {
        return this.displayName;
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, state: AppState): Comp => {
        // const prop = S.props.getProp(J.NodeProp.ORDER_BY, node);
        // I was trying to let this button decrypt, but react is saying the component got unmounted
        // and thrownging an error when the decrypt call below tries to update the state on a component
        // that somehow is already gone by the time it runs.
        //
        // Solution: I'm just going with the autoDecrypting==true setup for now, and will come back
        // and solve this later.
        //
        // else if (node.content && node.content.startsWith(J.Constant.ENC_TAG)) {
        //     return new Div(null, null, [
        //         markdownComp = new NodeCompMarkdown(node, state),
        //         new ButtonBar([
        //             new Button("Decrypt", () => {
        //                 markdownComp.decrypt();
        //             })
        //         ], null, "marginLeft marginBottom")
        //     ]);
        // }
        const comp: NodeCompMarkdown = (node.renderContent || node.content) ? new NodeCompMarkdown(node, this.getExtraMarkdownClass(), state) : null;

        /* if we notice we have URLs, then render them if available, but note they render asynchronously
        so this code will actually execute everytime a new OpenGraph result comes in and triggeres a state
        dispatch which causes a new render
        */
        // This OpenGraph logic should maybe be just built into the Markdown component itself?
        if (comp?.urls) {
            const children: CompIntf[] = [comp];
            let count = 0;
            comp.urls.forEach(url => {
                // allow max of 10 urls.
                if (count++ < 10) {
                    const og = new OpenGraphPanel(state, tabData, comp.getId("og" + count + "_"), url,
                        isLinkedNode ? "openGraphPanelBoost" : "openGraphPanel", "openGraphImage", true, true, true);
                    children.push(og);

                    if (tabData) {
                        tabData.openGraphComps.push(og);
                    }
                }
            });
            return new Div(null, null, children);
        }
        else {
            const isRoot = node.id === state.node?.id;
            // console.log("node [" + node.content + "] tags=" + node.tags)
            // If this node has tags render them below the content (if we have edit mode or info turned on)
            if (node.tags && (state.userPrefs.showMetaData || state.userPrefs.editMode)) {
                return new Div(null, null, [
                    comp,
                    new Div(node.tags, { className: "nodeTags float-end " + (isRoot ? "smallMarginBottom" : "") })
                ])
            }
            // otherwise just return the content component itself.
            else {
                return comp;
            }
        }
    }

    getIconClass(): string {
        // https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        if (!this.iconStyle) return null;
        return "fa " + this.iconStyle + " fa-lg";
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getDomPreUpdateFunction(parent: CompIntf): void {
    }

    ensureStringPropExists(node: J.NodeInfo, propName: string) {
        const prop = S.props.getProp(propName, node);
        if (!prop) {
            node.properties = node.properties || [];
            node.properties.push({
                name: propName,
                value: ""
            });
        }
    }

    /* When this returns true we know the main view should embed these nodes in a collapsed panel */
    isSpecialAccountNode(): boolean {
        return false;
    }

    subOrdinal(): number {
        return -1;
    }
}
