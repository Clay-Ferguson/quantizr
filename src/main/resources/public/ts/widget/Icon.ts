import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Icon extends Comp {

    constructor(public text: string, public callback: Function, _attribs: Object = null) {
        super(_attribs);
        this.attribs.onClick = callback;
    }

    compRender = (): ReactNode => {
        return S.e('i', this.attribs, null);
    }
}
