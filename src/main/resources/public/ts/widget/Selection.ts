import { Comp } from "./base/Comp";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { SelectionOption } from "./SelectionOption";
import { ReactNode } from "react";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Selection extends Comp {

    constructor(attribs: any, private label: string=null, public selectionOptions: Object[] = null, moreClasses: string="") {
        super(attribs || {});
        //w-25 = width 25%
        //https://hackerthemes.com/bootstrap-cheatsheet/#m-1 
        this.attribs.className = "custom-select "+moreClasses; 

        selectionOptions.forEach(function (row: Object) {
            //NOTE: for default selection we do it this way rather than the 'elm.selectedIndex' which is used to
            //to set selected item after rendered.
            this.children.push(new SelectionOption(row['key'], row['val']));
        }, this);
    }

    getSelection = (): string => {
        let elm: HTMLSelectElement = this.getElement() as HTMLSelectElement;
        if (!elm) {
            console.error("getSelection called on element "+this.jsClassName+" before it existed.")
            return null;
        }
        return elm.options[elm.selectedIndex].value;
    }

    setSelection = (key: string) => {
        this.whenElm((elm: HTMLSelectElement) => {
            let idx = -1;
            this.children.forEach(function(row: SelectionOption) {
                idx++;
                if (row.key == key) {
                    elm.selectedIndex = idx;
                }
            });
        });
    }

    compRender(): ReactNode {
        let children = [];
    
        if (this.label) {
            children.push(S.e("label", {
                id: this.getId()+"_label",
                key: this.getId()+"_label",
                htmlFor: this.getId()
            }, this.label));
        }

        children.push(this.tagRender('select', null, this.attribs));

        return S.e("div", {
            id: this.getId()+"_sel",
            key: this.getId()+"_sel",
            className: "form-group" //mr-2"
        }, children);
    }
}
