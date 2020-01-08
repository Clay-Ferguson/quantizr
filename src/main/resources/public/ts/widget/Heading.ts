import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Heading extends Comp {

    constructor(public level: number, public content: string, attrs: Object = {}) {
        super(attrs);
    }

    compRender = (p: any): ReactNode => {
        return S.e("h" + this.level, p, this.content);
    }
}
