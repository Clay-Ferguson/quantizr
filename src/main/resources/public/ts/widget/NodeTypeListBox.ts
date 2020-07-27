import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { ListBox } from "./ListBox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeTypeListBoxRow } from "./NodeTypeListBoxRow";
import { AppState } from "../AppState";
import { ValueIntf } from "../Interfaces";

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
