import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { PropTableCell } from "./PropTableCell";

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
