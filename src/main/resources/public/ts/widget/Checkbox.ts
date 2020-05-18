import * as I from "../Interfaces";
import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants as C} from "../Constants";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Checkbox extends Comp implements I.CheckboxIntf {

    constructor(public label: string = null, checked: boolean = false, _attribs: Object = null) {
        super(_attribs); 

        if (checked) {
            this.attribs.defaultChecked = "checked";
            this.setChecked(true);
        }
    
        this.attribs.type = "checkbox";
        this.attribs.className = "checkbox-indicator";
    }

    setChecked(checked: boolean) {
        this.whenElm((elm: HTMLElement) => {
            (<any>elm).checked = checked;
        });
    }

    getChecked(): boolean {
        let elm: HTMLElement = S.util.domElm(this.getId());
        return elm && (<any>elm).checked;
    }

    compRender(): ReactNode {
        let _attribs = this.attribs; //todo-1: remove unnecessary varible.

        if (this.label) {
            return S.e('span', { key: _attribs.id + "_span" }, S.e('input', _attribs), 
            S.e('label', { 
                key: _attribs.id + "_label", 
                className: "checkbox-label",
                htmlFor: _attribs.id 
            }, this.label));
        }
        else {
            return S.e('span', { key: _attribs.id + "_span" }, S.e('input', _attribs));
        }
    }
}
