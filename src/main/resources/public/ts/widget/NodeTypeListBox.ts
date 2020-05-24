import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ListBox } from "./ListBox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeTypeListBox extends ListBox {

    constructor(defaultSel: string, allowFileSysCreate: boolean) {
        super();

        this.mergeState({ selectedPayload: defaultSel });

        //First load the non-type (generic) type.
        //todo-0: I think it would be better if EVEN markdown had a TypeHandler even if it's default and doesn't show an icon
        //todo-0: no need to pass isSelectedFunc, since we pass the listbox already
        let children = [new NodeTypeListBoxRow(this, "Text/Markdown", "u", this.isSelectedFunc)];

        //Then load all the types from all the actual TypeHandlers.
        let typeHandlers = S.plugin.getAllTypeHandlers();
        S.util.forEachProp(typeHandlers, (k, typeHandler: TypeHandlerIntf): boolean => {
            if (typeHandler.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(this, typeHandler.getName(), typeHandler.getTypeName(), this.isSelectedFunc));
            }
            return true;
        });

        this.setChildren(children);
    }
}
