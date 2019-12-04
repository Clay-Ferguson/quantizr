console.log("Captcha.ts");

import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Captcha extends Comp {

    constructor() {
        super(null);
        this.setClass("captcha");
    }

    setSrc(src: string) {
        S.domBind.whenElm(this.getId(), (elm) => {
            elm.setAttribute("src", src);
        });
    }

    render = (p: any): React.ReactNode => {
        this.repairProps(p);
        let img = S.e('img', p);
        let div = S.e('div', null, img);
        return div;
    }
}
