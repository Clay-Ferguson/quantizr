import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Button extends Comp {

    constructor(text: string, public callback: Function, _attribs: Object = null, styleType: string="secondary") {
        super(_attribs);
        S.util.mergeAndMixProps(this.attribs, {
            className: "btn btn-"+styleType, /* also: secondary, info, success, danger, warning */
            type: "button"
        }, " ");

        this.attribs.onClick = callback;
        this.setText(text);
    }

    setText = (text: string) => {
        this.mergeState({
            text
        });
    }

    compRender = (): ReactNode => {
        //console.log("CompRender Button: "+this.jsClassName);

        let icon: any;
        if (this.attribs.iconclass) {
            icon = S.e('i', { 
                key: "s_"+this.getId(),
                className: this.attribs.iconclass,
                style: {
                    marginRight: "6px"
                }
            });
        }

        return S.e('button', {...this.attribs}, [icon, this.getState().text]);
    }
}
