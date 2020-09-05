import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { ValueIntf } from "../Interfaces";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ListBox } from "./ListBox";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeTypeListBox extends ListBox {

    constructor(valueIntf: ValueIntf, public appState: AppState) {
        super(valueIntf);
    }

    preRender(): void {
        let children = [];

        let typeHandlers = S.plugin.getAllTypeHandlers();
        S.util.forEachProp(typeHandlers, (k, typeHandler: TypeHandlerIntf): boolean => {
            if (this.appState.isAdminUser || typeHandler.getAllowUserSelect()) {
                children.push(new NodeTypeListBoxRow(typeHandler, () => {
                    this.updateValFunc(typeHandler.getTypeName());
                }, this.valueIntf.getValue()==typeHandler.getTypeName()));
            }
            return true;
        });

        this.setChildren(children);
    }
}
