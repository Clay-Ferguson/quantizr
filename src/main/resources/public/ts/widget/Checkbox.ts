import { ReactNode } from "react";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Checkbox extends Comp implements I.CheckboxIntf {

    outterClassName: string;

    constructor(public label: string = null, _attribs: Object = null, private valueIntf: ValueIntf, private compactHeight: boolean = false) {
        super(_attribs);

        if (!valueIntf) {
            this.valueIntf = new CompValueHolder<string>(this, "val");
        }

        this.attribs.type = "checkbox";

        // kinda tricky, but any className passed in gets applied on the outter container.
        this.outterClassName = this.attribs.className || "";

        this.attribs.className = "custom-control-input";

        this.attribs.onChange = (evt: any) => {
            this.updateValFunc(evt.target.checked);
        };
    }

    // Handler to update state
    updateValFunc(value: boolean): void {
        if (value !== this.valueIntf.getValue()) {
            this.valueIntf.setValue(value);

            // needing this line took a while to figure out. If nothing is setting any actual detectable state change
            // during his call we have to do this here.
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
        // double-bang is important here becasue we do need to support the 'getvalue' comming back as null, or undefined, and in all cases
        // convert that to exactly the value 'true' or else React itself (internal to React) will fail
        this.attribs.checked = !!this.valueIntf.getValue();

        let spanClass = this.compactHeight ? "inline-checkbox-compact" : "inline-checkbox";

        return this.e("span", {
            key: this.attribs.id + "_span",
            // there is also a 'custom-control-inline' that could be used instead of 'inline-checkbox' but it adds space to the right
            // NOTE: custom-switch or custom-checkbox will work here with all other things being identical! The custom-switch shows
            // a little slider switch button instead of a box with a check.
            className: "custom-control custom-checkbox " + spanClass + " " + this.outterClassName
        }, this.e("input", this.attribs),
            // warning without this label element the entire control fails to render, and this is apparently related to bootstrap itself.
            this.e("label", {
                key: this.attribs.id + "_label",
                className: "custom-control-label " + (this.label ? "checkboxLabel" : ""),
                htmlFor: this.attribs.id
            }, this.label || ""));
    }
}
