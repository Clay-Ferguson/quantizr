import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants } from "../Constants";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Textarea extends Comp {

    constructor(public attribs: any) {
        super(attribs);
        S.util.mergeProps(this.attribs, {
            //"name": this.getId(),
            //"type": "text",
            className: "form-control pre-textarea"
        });
        if (!this.attribs.rows) {
            this.attribs.rows = "5";
        }
    }

    getValue = (): string => {
        let elm = this.getElement();
        if (elm) {
            return (<any>elm).value.trim();
        }
        /* we just resort to returning the value the object was originally created to have if the gui elmement doesn't exist yet on the DOM
        when we got into here */
        else {
            return this.attribs.value;
        }
    }

    setValue = (val: string): void => {
        this.attribs.value = val;
        let elm = this.getElement();
        if (elm) {
            //is it necessary to set attribs, i'm kinda rusty on how this works. I'm thinking if we call 'setValue' before this Widget
            //ever gets rendered we better have it's attribs value correct right?
            (<any>elm).value = val;
        }
    }

    compRender = (p: any): ReactNode => {
        p = this.attribs;

        this.repairProps(p);
        let children = [];
    
        if (p.label) {
            children.push(S.e('label', {
                id: this.getId()+"_label",
                key: this.getId()+"_label",
                htmlFor: this.getId()
            }, p.label));
        }

        children.push(S.e('textarea', p, this.attribs.value));
        return S.e('div', {
            id: this.getId()+"_textfield",
            key: this.getId()+"_textfield",
        }, children);
    }
}
