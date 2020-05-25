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
        let children = [];

        //Then load all the types from all the actual TypeHandlers.
        let typeHandlers = S.plugin.getAllTypeHandlers();
        S.util.forEachProp(typeHandlers, (k, typeHandler: TypeHandlerIntf): boolean => {
            if (typeHandler.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(this, typeHandler.getName(), typeHandler.getTypeName()));
            }
            return true;
        });

        this.setChildren(children);
    }
}
