import { AppState } from "../../AppState";
import { NodeCompMarkdown } from "../../comps/NodeCompMarkdown";
import { Constants as C } from "../../Constants";
import { NodeActionType } from "../../enums/NodeActionType";
import { TypeHandlerIntf } from "../../intf/TypeHandlerIntf";
import * as J from "../../JavaIntf";
import { PubSub } from "../../PubSub";
import { Singletons } from "../../Singletons";
import { Comp } from "../../widget/base/Comp";
import { CompIntf } from "../../widget/base/CompIntf";
import { Div } from "../../widget/Div";
import { ButtonBar } from "../../widget/ButtonBar";
import { Button } from "../../widget/Button";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

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

    getTypeName(): string {
        return this.typeName;
    }

    /* If this returns non-null the editor dialog is expected to show only the enumerated properties for editing

    note: adding 'content' to this (not a genuine property like the rest, is allowed)
    */
    getCustomProperties(): string[] {
        return null;
    }

    hasCustomProp = (prop: string): boolean => {
        let customProps = this.getCustomProperties();
        if (!customProps) return false;
        return !!customProps.find(p => p === prop);
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

        let prop: J.PropertyInfo = S.props.getNodeProp(J.NodeProp.ORDER_BY, node);

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
        return new NodeCompMarkdown(node, state);
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
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
