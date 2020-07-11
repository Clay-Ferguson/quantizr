import * as I from "../Interfaces";
import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";
import { ValueIntf } from "../Interfaces";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Checkbox extends Comp implements I.CheckboxIntf {

    constructor(public label: string = null, _attribs: Object = null, private valueIntf: ValueIntf = null) {
        super(_attribs);

        this.attribs.type = "checkbox";
        if (!valueIntf) {
            throw new Error("valueIntf is required in Checkbox class");
        }

        this.attribs.onChange = (evt: any) => {
            Comp.renderCachedChildren = true;

            try {
                //console.log("e.target.checked=" + evt.target.checked);
                this.updateValFunc(evt.target.checked);
            }
            finally {
                /* React doesn't have a 'global' way to know when all rendering that's about to be done HAS been done, so all we can do here, is
                use a timeout */
                setTimeout(() => {
                    Comp.renderCachedChildren = false;
                }, 250);
            }
        }
    }

    //Handler to update state
    updateValFunc(value: boolean): void {
        if (value != this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);

            //needing this line took a while to figure out. If nothing is setting any actual detectable state change
            //during his call we have to do this here.
            this.forceRender();
        }
    }

    setChecked(val: boolean): void {
        this.valueIntf.setValue(val);
    }

    getChecked(): boolean {
        return this.valueIntf.getValue();
    }

    compRender(): ReactNode {
        let _attribs = this.attribs; //todo-0: remove unnecessary varible.
        _attribs.checked = this.valueIntf.getValue();

        //console.log("Rendering checkbox: [" + this.label + "] checked=" + _attribs.checked);

        if (this.label) {
            return S.e("span", { key: _attribs.id + "_span" }, S.e("input", _attribs),
                S.e("label", {
                    key: _attribs.id + "_label",
                    className: "checkbox-label",
                    htmlFor: _attribs.id
                }, this.label));
        }
        else {
            return S.e("span", { key: _attribs.id + "_span" }, S.e("input", _attribs));
        }
    }
}
