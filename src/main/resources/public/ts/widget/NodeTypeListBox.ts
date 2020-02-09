import { ListBoxRow } from "./ListBoxRow";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ListBox } from "./ListBox";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NodeTypeListBox extends ListBox {
    selType: string = "u";
    
    constructor(defaultSel: string, allowFileSysCreate : boolean) {
        super();

        //First load the non-type (generic) type.
        let children = [new ListBoxRow("Text/Markdown", () => { this.selType = "u"; }, true)];

        //Then load all the types from all the actual TypeHandlers.
        let typeHandlers = S.plugin.getAllTypeHandlers();
        S.util.forEachProp(typeHandlers, (k, typeHandler: TypeHandlerIntf): boolean => {
            children.push(new ListBoxRow(typeHandler.getName(), () => { this.selType = typeHandler.getTypeName(); }, false));
            return true;
        });

        this.setChildren(children);
    }
}
