import { Comp } from "./base/Comp";
import { PropTableCell } from "./PropTableCell";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PropTableRow extends Comp {

    constructor(attribs: Object = {}, initialChildren: PropTableCell[] = null) {
        super(attribs);
        //(<any>this.attribs).style = "display: table-row;";
        //(<any>this.attribs).sourceClass = "EditPropsTableRow";
        this.setChildren(initialChildren);
    }

    compRender(): ReactNode {
        return this.tagRender("tr", null, this.attribs);
    }
}
