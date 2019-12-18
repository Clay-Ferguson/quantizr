console.log("TextField.ts");

import { Comp } from "./base/Comp";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";

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

    render = (p: any): string => {
        let children = [];
    
        if (p.label) {
            //This is a hack to get the password managers of browsers to work the way we want. When prompting for an encryption password, there is NO
            //username that makes sense for that, so we use "Master Password" prefill value to make this whole thing hidden;
            children.push(S.e('label', {
                id: this.getId()+"_label",
                //style : this.prefillVal=="Master Password" ? {display: "none"} : {display: "block"},
                className: 'textfield-label',
                htmlFor: this.getId()
            }, p.label));
        }

        console.log("render input");

        children.push(S.e('input', this.attribs));
        return S.e('div', {
            id: this.getId()+"_textfield",
        }, children);
    }
}
