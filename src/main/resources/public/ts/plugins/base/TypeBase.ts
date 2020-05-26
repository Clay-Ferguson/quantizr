import * as J from "../../JavaIntf";
import { Constants as C } from "../../Constants";
import { Singletons } from "../../Singletons";
import { PubSub } from "../../PubSub";
import { TypeHandlerIntf } from "../../intf/TypeHandlerIntf";
import { Comp } from "../../widget/base/Comp";
import { NodeCompMarkdown } from "../../comps/NodeCompMarkdown";
import { AppState } from "../../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* NOTE: Defaults to only allowing 'admin' to edit unless allowPropertyEdit is overridden */
export class TypeBase implements TypeHandlerIntf {

    constructor(public readonly typeName: string, public readonly displayName: string, private iconStyle: string, private allowUserSelect: boolean) {
    }

    getTypeName(): string {
        return this.typeName;
    }

    getName(): string {
        return this.displayName;
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {
        return new NodeCompMarkdown(node);
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
    }

    getIconClass(): string {
        //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        if (!this.iconStyle) return null;
        return "fa " + this.iconStyle + " fa-lg";
    }

    allowAction(action: string): boolean {
        return true;
    }

    getAllowUserSelect(): boolean {
        return this.allowUserSelect;
    }
}


