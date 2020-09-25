import { ReactNode } from "react";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class IconButton extends Comp {

    constructor(public iconClass: string = "", public text: string, attribs: Object = {}, private specialClasses: string = "btn-primary", private toggle: string = "") {
        super(attribs);
        this.attribs.type = "button";
        this.attribs.className = "btn align-middle " + specialClasses;
    }

    compRender(): ReactNode {
        let state = this.getState();
        let _style = { display: (state.visible && !state.disabled ? "" : "none") };
        let _attribs = { ...this.attribs, ...{ style: _style } };

        let toggleClass = "";
        if (this.toggle === "on") {
            toggleClass = " iconToggleOn";
        }
        else if (this.toggle === "off") {
            toggleClass = " iconToggleOff";
        }

        return S.e("button", _attribs,
            S.e("i", {
                key: "i_" + this.getId(),
                className: "fa fa-lg " + this.iconClass + toggleClass
            }, [
                S.e("span", {
                    key: "s_" + this.getId(),
                    className: "button-font"
                }, this.text === null ? null : " " + this.text)
            ], true)
        );
    }
}
