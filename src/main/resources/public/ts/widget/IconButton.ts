import { Comp } from "./base/Comp";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* todo-0: rename this to IconButton */
export class IconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: Object = {}, private specialClasses: string = "", private toggle: string = "") {
        super(attribs);
        this.attribs.type = "button";
        this.attribs.className = "btn " + specialClasses + " align-middle btn-primary";
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible && !state.disabled ? '' : 'none') };
        let _attribs = { ...this.attribs, ...{ style: _style } };

        let toggleClass = "";
        if (this.toggle=="on") {
            toggleClass = " iconToggleOn";
        }
        else if (this.toggle=="off") {
            toggleClass = " iconToggleOff";
        }

        return S.e("button", _attribs,
            S.e("i", {
                key: "i_" + this.getId(),
                className: "fa fa-lg " + this.iconClass + toggleClass,
            }, [
                S.e("span", {
                    key: "s_" + this.getId(),
                    className: 'button-font'
                }, this.text == null ? null : " " + this.text)
            ], true)
        );
    }
}
