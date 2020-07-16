import * as J from "../../JavaIntf";
import { Constants as C } from "../../Constants";
import { Singletons } from "../../Singletons";
import { PubSub } from "../../PubSub";
import { TypeHandlerIntf } from "../../intf/TypeHandlerIntf";
import { Comp } from "../../widget/base/Comp";
import { NodeCompMarkdown } from "../../comps/NodeCompMarkdown";
import { AppState } from "../../AppState";
import { CompIntf } from "../../widget/base/CompIntf";
import { NodeActionType } from "../../enums/NodeActionType";
import { InlineEditField } from "../../widget/InlineEditField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* NOTE: Defaults to only allowing 'admin' to edit unless allowPropertyEdit is overridden */
export class TypeBase implements TypeHandlerIntf {

    constructor(public readonly typeName: string, public readonly displayName: string, private iconStyle: string, private allowUserSelect: boolean) {
    }

    getAllowUserSelect(): boolean {
        return this.allowUserSelect;
    }

    getEditLabelForProp(propName: string): string {
        return propName;
    }

    /* Enables editor to show buttons for adding/deleting custom properties */
    getAllowPropertyAdd(): boolean {
        return true;
    }

    /* Enables editor to control wether content edit textarea shows up in editor dialog */
    getAllowContentEdit(): boolean {
        return true;
    }

    getTypeName(): string {
        return this.typeName;
    }

    /* If this returns non-null the editor dialog is expected to show only the enumerated properties for editing 
    
    note: adding 'content' to this (not a genuine property like the rest, is allowed)
    */
    getCustomProperties(): string[] {
        return null;
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

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        if (state.inlineEditId == node.id) {
            return new InlineEditField(node, state);
        }
        else {
            return new NodeCompMarkdown(node, state);
        }
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
    }

    getIconClass(): string {
        //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        if (!this.iconStyle) return null;
        return "fa " + this.iconStyle + " fa-lg";
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    getDomPreUpdateFunction(parent: CompIntf): void {
    }

    ensureStringPropExists(node: J.NodeInfo, propName: string) {
        let prop: J.PropertyInfo = S.props.getNodeProp(propName, node);
        if (!prop) {
            if (!node.properties) {
                node.properties = [];
            }

            node.properties.push({
                name: propName,
                value: ""
            });
        }
    }
}


