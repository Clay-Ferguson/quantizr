import { Comp } from "./base/Comp";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class NavBarIconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: Object = {}, private specialClasses: string = "nav-link" /* small-margin-right */) {
        super(attribs);
        this.attribs.type = "button";
        this.attribs.className = "btn " + specialClasses + " align-middle btn-primary";
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible && !state.disabled ? '' : 'none') };
        let _attribs = { ...this.attribs, ...{ style: _style } };

        return S.e("button", _attribs,
            S.e("i", {
                key: "i_" + this.getId(),
                className: "fa fa-lg " + this.iconClass,
            }, [
                S.e("span", {
                    key: "s_" + this.getId(),
                    className: 'button-font'
                }, this.text == null ? null : " " + this.text)
            ], true)
        );
    }
}
