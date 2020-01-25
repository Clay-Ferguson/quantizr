import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TextField extends Comp {

    constructor(public attribs: any = null, private prefillVal : string=null) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            "name": this.getId(),
            "type": "text",
            className: "form-control pre-textfield textfield"
        });

        if (prefillVal) {
            this.whenElm((elm: HTMLInputElement) => {
                elm.value = prefillVal;
            });
        }
    }

    setValue = (val: string): void => {
        S.util.setInputVal(this.getId(), val || "");
    }

    getValue = (): string => {
        let elm = this.getElement();
        if (elm) {
            return (<any>elm).value.trim();
        }
        return null;
    }

    focus = (): void => {
        S.util.delayedFocus(this.getId());
    }

    compRender = (): ReactNode => {
        let children = [];
    
        if (this.attribs.label) {
            children.push(S.e('label', {
                id: this.getId()+"_label",
                key: this.getId()+"_label",
                className: 'textfield-label', //is this still needed ?
                htmlFor: this.getId()
            }, this.attribs.label));
        }

        children.push(S.e('input', this.attribs));

        return S.e('div', {
            id: this.getId()+"_text",
            key: this.getId()+"_text",
        }, children);
    }
}
